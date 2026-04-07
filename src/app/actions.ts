"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";

async function requireAllowedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return { supabase, user };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createPost(formData: FormData) {
  const { supabase } = await requireAllowedUser();

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const contentFormat = String(formData.get("content_format") ?? "markdown");

  if (!title || !content) {
    redirect("/new?error=missing_fields");
  }

  if (contentFormat !== "markdown" && contentFormat !== "richtext") {
    redirect("/new?error=invalid_content_format");
  }

  const { error } = await supabase.schema("blog").from("posts").insert({
    title,
    content,
    content_format: contentFormat,
  });

  if (error) {
    const detail = encodeURIComponent(error.message || error.code || "unknown_error");
    redirect(`/new?error=create_post_failed&detail=${detail}`);
  }

  revalidatePath("/");
  redirect("/");
}

export async function addComment(formData: FormData) {
  const { supabase } = await requireAllowedUser();

  const postId = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const parentIdRaw = String(formData.get("parent_id") ?? "").trim();
  const parentId = parentIdRaw || null;

  if (!postId || !body) {
    redirect(postId ? `/post/${postId}?error=missing_comment_fields` : "/?error=missing_comment_fields");
  }

  if (parentId) {
    const { data: parentComment } = await supabase
      .schema("blog")
      .from("comments")
      .select("id, post_id")
      .eq("id", parentId)
      .maybeSingle();

    if (!parentComment || parentComment.post_id !== postId) {
      redirect(`/post/${postId}?error=invalid_parent_comment`);
    }
  }

  const { error } = await supabase.schema("blog").from("comments").insert({
    post_id: postId,
    parent_id: parentId,
    body,
  });

  if (error) {
    const detail = encodeURIComponent(error.message || error.code || "unknown_error");
    redirect(`/post/${postId}?error=comment_failed&detail=${detail}`);
  }

  revalidatePath(`/post/${postId}`);
  redirect(`/post/${postId}`);
}

export async function voteComment(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();

  const postId = String(formData.get("post_id") ?? "").trim();
  const commentId = String(formData.get("comment_id") ?? "").trim();
  const voteRaw = Number(formData.get("vote"));
  const vote = voteRaw === 1 ? 1 : voteRaw === -1 ? -1 : 0;

  if (!postId || !commentId || vote === 0) {
    redirect(postId ? `/post/${postId}?error=invalid_vote_payload` : "/?error=invalid_vote_payload");
  }

  const { data: comment } = await supabase
    .schema("blog")
    .from("comments")
    .select("id, post_id")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment || comment.post_id !== postId) {
    redirect(`/post/${postId}?error=comment_not_found`);
  }

  const { data: existing } = await supabase
    .schema("blog")
    .from("comment_votes")
    .select("id, vote")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.vote === vote) {
    const { error: deleteError } = await supabase
      .schema("blog")
      .from("comment_votes")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      redirect(`/post/${postId}?error=${encodeURIComponent(deleteError.message || "vote_delete_failed")}`);
    }
  } else {
    const { error: upsertError } = await supabase.schema("blog").from("comment_votes").upsert(
      {
        comment_id: commentId,
        user_id: user.id,
        vote,
      },
      { onConflict: "comment_id,user_id" },
    );

    if (upsertError) {
      redirect(`/post/${postId}?error=${encodeURIComponent(upsertError.message || "vote_upsert_failed")}`);
    }
  }

  revalidatePath(`/post/${postId}`);
  redirect(`/post/${postId}`);
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();

  const username = String(formData.get("username") ?? "").trim();
  const avatarUrlRaw = String(formData.get("avatar_url") ?? "").trim();
  const avatarUrl = avatarUrlRaw || null;

  if (username.length < 2 || username.length > 50) {
    redirect("/profile?error=invalid_username");
  }

  const { error } = await supabase.schema("blog").from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "unknown",
      username,
      avatar_url: avatarUrl,
    },
    { onConflict: "id" },
  );

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message || "update_failed")}`);
  }

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?success=1");
}
