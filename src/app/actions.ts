"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { evaluateAngelInvestment } from "@/lib/angel-investor";

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

async function runAngelEvaluationForPost(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  postId: string;
  title: string;
  content: string;
  contentFormat: "markdown" | "richtext";
}) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { ok: false as const, status: "missing_openai_key" as const };
  }

  const angelResult = await evaluateAngelInvestment({
    title: params.title,
    content: params.content,
    contentFormat: params.contentFormat,
  });

  if (!angelResult) {
    return { ok: false as const, status: "evaluation_failed" as const };
  }

  const { error: updateError } = await params.supabase
    .schema("blog")
    .from("posts")
    .update({
      investment_eur: angelResult.amountEur,
      investment_confidence: angelResult.confidence,
      investment_thesis: angelResult.thesis,
      investment_model: angelResult.model,
      investment_created_at: new Date().toISOString(),
    })
    .eq("id", params.postId);

  if (updateError) {
    return {
      ok: false as const,
      status: "db_update_failed" as const,
      detail: updateError.message || updateError.code || "update_failed",
    };
  }

  return { ok: true as const, status: "evaluated" as const };
}

function appendEvalStatus(path: string, status: string, detail?: string) {
  const [pathname, existingQuery = ""] = path.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set("eval_status", status);
  if (detail) {
    params.set("eval_detail", detail);
  } else {
    params.delete("eval_detail");
  }
  return `${pathname}?${params.toString()}`;
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

  const { data: insertedPost, error } = await supabase
    .schema("blog")
    .from("posts")
    .insert({
      title,
      content,
      content_format: contentFormat,
    })
    .select("id")
    .single();

  if (error) {
    const detail = encodeURIComponent(error.message || error.code || "unknown_error");
    redirect(`/new?error=create_post_failed&detail=${detail}`);
  }

  if (insertedPost?.id) {
    await runAngelEvaluationForPost({
      supabase,
      postId: insertedPost.id,
      title,
      content,
      contentFormat: contentFormat as "markdown" | "richtext",
    });
  }

  revalidatePath("/");
  redirect("/");
}

export async function evaluatePostInvestment(formData: FormData) {
  const { supabase } = await requireAllowedUser();

  const postId = String(formData.get("post_id") ?? "").trim();
  const redirectToRaw = String(formData.get("redirect_to") ?? "/").trim();
  const redirectTo = redirectToRaw.startsWith("/") ? redirectToRaw : "/";

  if (!postId) {
    redirect(appendEvalStatus(redirectTo, "missing_post_id"));
  }

  const { data: post } = await supabase
    .schema("blog")
    .from("posts")
    .select("id, title, content, content_format, investment_eur")
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    redirect(appendEvalStatus(redirectTo, "post_not_found"));
  }

  if (post.investment_eur !== null && post.investment_eur !== undefined) {
    redirect(appendEvalStatus(redirectTo, "already_evaluated"));
  }

  const result = await runAngelEvaluationForPost({
      supabase,
      postId: post.id,
      title: post.title,
      content: post.content,
      contentFormat: post.content_format as "markdown" | "richtext",
  });

  revalidatePath("/");
  revalidatePath(`/post/${post.id}`);
  if (result.ok) {
    redirect(appendEvalStatus(redirectTo, "evaluated"));
  }

  redirect(appendEvalStatus(redirectTo, result.status, result.detail));
}

export async function addComment(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();

  const postId = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const parentIdRaw = String(formData.get("parent_id") ?? "").trim();
  const parentId = parentIdRaw || null;

  if (!postId || !body) {
    redirect(postId ? `/post/${postId}?error=missing_comment_fields` : "/?error=missing_comment_fields");
  }

  let parentCommentAuthorId: string | null = null;
  if (parentId) {
    const { data: parentComment } = await supabase
      .schema("blog")
      .from("comments")
      .select("id, post_id, author_id")
      .eq("id", parentId)
      .maybeSingle();

    if (!parentComment || parentComment.post_id !== postId) {
      redirect(`/post/${postId}?error=invalid_parent_comment`);
    }

    parentCommentAuthorId = parentComment.author_id;
  }

  const { data: postOwner } = await supabase
    .schema("blog")
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .maybeSingle();

  const { data: insertedComment, error } = await supabase
    .schema("blog")
    .from("comments")
    .insert({
    post_id: postId,
    parent_id: parentId,
    body,
    })
    .select("id")
    .single();

  if (error) {
    const detail = encodeURIComponent(error.message || error.code || "unknown_error");
    redirect(`/post/${postId}?error=comment_failed&detail=${detail}`);
  }

  if (insertedComment) {
    const notifications: Array<{
      recipient_id: string;
      actor_id: string;
      type: "comment_on_post" | "reply_to_comment";
      post_id: string;
      comment_id: string;
      parent_comment_id: string | null;
    }> = [];

    const postAuthorId = postOwner?.author_id ?? null;
    if (postAuthorId && postAuthorId !== user.id) {
      notifications.push({
        recipient_id: postAuthorId,
        actor_id: user.id,
        type: "comment_on_post",
        post_id: postId,
        comment_id: insertedComment.id,
        parent_comment_id: parentId,
      });
    }

    if (
      parentCommentAuthorId &&
      parentCommentAuthorId !== user.id &&
      parentCommentAuthorId !== postAuthorId
    ) {
      notifications.push({
        recipient_id: parentCommentAuthorId,
        actor_id: user.id,
        type: "reply_to_comment",
        post_id: postId,
        comment_id: insertedComment.id,
        parent_comment_id: parentId,
      });
    }

    if (notifications.length) {
      await supabase.schema("blog").from("notifications").insert(notifications);
      for (const notification of notifications) {
        revalidatePath(notification.recipient_id === user.id ? "/profile" : `/user/${notification.recipient_id}`);
      }
      revalidatePath("/notifications");
    }
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

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireAllowedUser();

  await supabase
    .schema("blog")
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  revalidatePath("/notifications");
  redirect("/notifications");
}
