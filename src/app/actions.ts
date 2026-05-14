"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { evaluateAngelInvestment } from "@/lib/angel-investor";
import { getUserInvestmentSummary } from "@/lib/investments";
import { sendNewPostEmail } from "@/lib/email";
import { sendPushNotificationsForNotifications } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { shouldRespondToComment, shouldVoteOnComment } from "@/lib/comment-responder-agent";

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

function appendInvestStatus(path: string, status: string, detail?: string) {
  const [pathname, existingQuery = ""] = path.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set("invest_status", status);
  if (detail) {
    params.set("invest_detail", detail);
  } else {
    params.delete("invest_detail");
  }
  return `${pathname}?${params.toString()}`;
}

function buildEmailContentHtml(content: string, contentFormat: "markdown" | "richtext"): string {
  if (contentFormat === "richtext") {
    return content;
  }

  return `<p>${content.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br />")}</p>`;
}

const PROJECT_STATUSES = [
  "idea",
  "concept",
  "validation",
  "building",
  "launched",
  "archived",
] as const;

type ProjectStatus = (typeof PROJECT_STATUSES)[number];
const MAX_PROJECT_SUMMARY_LENGTH = 50000;

function isProjectStatus(value: string): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus);
}

function parseProjectIds(formData: FormData): string[] {
  const values = formData
    .getAll("project_ids")
    .map((entry) => String(entry).trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createPost(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const contentFormat = String(formData.get("content_format") ?? "markdown");
  const projectIds = parseProjectIds(formData);

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
    if (projectIds.length) {
      const linkRows = projectIds.map((projectId) => ({
        project_id: projectId,
        post_id: insertedPost.id,
      }));

      const { error: linkError } = await supabase
        .schema("blog")
        .from("project_posts")
        .insert(linkRows);

      if (linkError) {
        const detail = encodeURIComponent(linkError.message || linkError.code || "link_projects_failed");
        redirect(`/new?error=project_link_failed&detail=${detail}`);
      }

      revalidatePath("/projects");
      for (const projectId of projectIds) {
        revalidatePath(`/projects/${projectId}`);
      }
    }

    const preview = buildEmailContentHtml(content, contentFormat as "markdown" | "richtext");

    try {
      await sendNewPostEmail({
        postId: insertedPost.id,
        title,
        authorEmail: user.email ?? "unknown",
        preview,
      });
    } catch (emailError) {
      console.error("Failed to send new post email", emailError);
    }

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

export async function createProject(formData: FormData) {
  const { supabase } = await requireAllowedUser();

  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const summaryFormat = String(formData.get("summary_format") ?? "richtext").trim();
  const statusRaw = String(formData.get("status") ?? "idea").trim();
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
  const websiteUrlRaw = String(formData.get("website_url") ?? "").trim();
  const githubRepoUrlRaw = String(formData.get("github_repo_url") ?? "").trim();

  if (!title || !summary) {
    redirect("/projects/new?error=missing_fields");
  }

  if (summary.length > MAX_PROJECT_SUMMARY_LENGTH) {
    redirect(`/projects/new?error=invalid_summary_length&detail=${MAX_PROJECT_SUMMARY_LENGTH}`);
  }

  if (!isProjectStatus(statusRaw)) {
    redirect("/projects/new?error=invalid_status");
  }

  if (summaryFormat !== "markdown" && summaryFormat !== "richtext") {
    redirect("/projects/new?error=invalid_summary_format");
  }

  const imageUrl = imageUrlRaw || null;
  const websiteUrl = websiteUrlRaw || null;
  const githubRepoUrl = githubRepoUrlRaw || null;

  const { data: project, error } = await supabase
    .schema("blog")
    .from("projects")
    .insert({
      title,
      summary,
      summary_format: summaryFormat,
      status: statusRaw,
      image_url: imageUrl,
      website_url: websiteUrl,
      github_repo_url: githubRepoUrl,
    })
    .select("id, status")
    .single();

  if (error || !project) {
    const detail = encodeURIComponent(error?.message || error?.code || "create_project_failed");
    redirect(`/projects/new?error=create_project_failed&detail=${detail}`);
  }

  await supabase.schema("blog").from("project_status_history").insert({
    project_id: project.id,
    from_status: null,
    to_status: project.status,
    rationale: "Project created",
  });

  revalidatePath("/projects");
  revalidatePath("/new");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectStatus(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();

  const projectId = String(formData.get("project_id") ?? "").trim();
  const toStatus = String(formData.get("to_status") ?? "").trim();
  const rationaleRaw = String(formData.get("rationale") ?? "").trim();

  if (!projectId || !isProjectStatus(toStatus)) {
    redirect(projectId ? `/projects/${projectId}?error=invalid_status_payload` : "/projects?error=invalid_status_payload");
  }

  const rationale = rationaleRaw || "Status updated";

  const { data: existingProject } = await supabase
    .schema("blog")
    .from("projects")
    .select("id, status, owner_user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!existingProject) {
    redirect("/projects?error=project_not_found");
  }

  if (existingProject.owner_user_id !== user.id) {
    redirect(`/projects/${projectId}?error=forbidden`);
  }

  if (existingProject.status === toStatus) {
    redirect(`/projects/${projectId}?status_updated=0`);
  }

  const { error: updateError } = await supabase
    .schema("blog")
    .from("projects")
    .update({ status: toStatus })
    .eq("id", projectId);

  if (updateError) {
    const detail = encodeURIComponent(updateError.message || updateError.code || "project_status_update_failed");
    redirect(`/projects/${projectId}?error=project_status_update_failed&detail=${detail}`);
  }

  const { error: historyError } = await supabase
    .schema("blog")
    .from("project_status_history")
    .insert({
      project_id: projectId,
      from_status: existingProject.status,
      to_status: toStatus,
      rationale,
    });

  if (historyError) {
    const detail = encodeURIComponent(historyError.message || historyError.code || "project_history_failed");
    redirect(`/projects/${projectId}?error=project_history_failed&detail=${detail}`);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?status_updated=1`);
}

export async function updateProjectDetails(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();

  const projectId = String(formData.get("project_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const summaryFormat = String(formData.get("summary_format") ?? "richtext").trim();
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
  const websiteUrlRaw = String(formData.get("website_url") ?? "").trim();
  const githubRepoUrlRaw = String(formData.get("github_repo_url") ?? "").trim();
  const noteRaw = String(formData.get("edit_note") ?? "").trim();

  if (!projectId || !title || !summary) {
    redirect(projectId ? `/projects/${projectId}?error=missing_project_fields` : "/projects?error=missing_project_fields");
  }

  if (summary.length > MAX_PROJECT_SUMMARY_LENGTH) {
    redirect(`/projects/${projectId}/edit?error=invalid_summary_length&detail=${MAX_PROJECT_SUMMARY_LENGTH}`);
  }

  if (summaryFormat !== "markdown" && summaryFormat !== "richtext") {
    redirect(`/projects/${projectId}/edit?error=invalid_summary_format`);
  }

  const imageUrl = imageUrlRaw || null;
  const websiteUrl = websiteUrlRaw || null;
  const githubRepoUrl = githubRepoUrlRaw || null;
  const note = noteRaw || null;

  const { data: existingProject } = await supabase
    .schema("blog")
    .from("projects")
    .select("id, owner_user_id, title, summary, summary_format, image_url, website_url, github_repo_url")
    .eq("id", projectId)
    .maybeSingle();

  if (!existingProject) {
    redirect("/projects?error=project_not_found");
  }

  if (existingProject.owner_user_id !== user.id) {
    redirect(`/projects/${projectId}?error=forbidden`);
  }

  const changedFields: string[] = [];
  const previousValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};

  const candidateChanges: Array<{ key: string; before: string | null; after: string | null }> = [
    { key: "title", before: existingProject.title, after: title },
    { key: "summary", before: existingProject.summary, after: summary },
    { key: "summary_format", before: existingProject.summary_format, after: summaryFormat },
    { key: "image_url", before: existingProject.image_url, after: imageUrl },
    { key: "website_url", before: existingProject.website_url, after: websiteUrl },
    { key: "github_repo_url", before: existingProject.github_repo_url, after: githubRepoUrl },
  ];

  for (const change of candidateChanges) {
    if ((change.before ?? null) !== (change.after ?? null)) {
      changedFields.push(change.key);
      previousValues[change.key] = change.before ?? null;
      newValues[change.key] = change.after ?? null;
    }
  }

  if (!changedFields.length) {
    redirect(`/projects/${projectId}?project_updated=0`);
  }

  const { error: updateError } = await supabase
    .schema("blog")
    .from("projects")
    .update({
      title,
      summary,
      summary_format: summaryFormat,
      image_url: imageUrl,
      website_url: websiteUrl,
      github_repo_url: githubRepoUrl,
    })
    .eq("id", projectId);

  if (updateError) {
    const detail = encodeURIComponent(updateError.message || updateError.code || "project_update_failed");
    redirect(`/projects/${projectId}/edit?error=project_update_failed&detail=${detail}`);
  }

  const { error: historyError } = await supabase
    .schema("blog")
    .from("project_edit_history")
    .insert({
      project_id: projectId,
      changed_fields: changedFields,
      previous_values: previousValues,
      new_values: newValues,
      note,
    });

  if (historyError) {
    const detail = encodeURIComponent(historyError.message || historyError.code || "project_edit_history_failed");
    redirect(`/projects/${projectId}/edit?error=project_edit_history_failed&detail=${detail}`);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?project_updated=1`);
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

export async function investInPost(formData: FormData) {
  const { supabase, user } = await requireAllowedUser();

  const postId = String(formData.get("post_id") ?? "").trim();
  const redirectToRaw = String(formData.get("redirect_to") ?? "/").trim();
  const redirectTo = redirectToRaw.startsWith("/") ? redirectToRaw : "/";
  const amount = Number(String(formData.get("amount") ?? "").trim());

  if (!postId) {
    redirect(appendInvestStatus(redirectTo, "missing_post_id"));
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(appendInvestStatus(redirectTo, "invalid_amount"));
  }

  const { data: resultRows, error } = await supabase.schema("blog").rpc("invest_in_post", {
    target_post_id: postId,
    investment_amount: Math.round(amount),
  });

  if (error) {
    redirect(appendInvestStatus(redirectTo, "db_update_failed", error.message || error.code || "investment_failed"));
  }

  const result = Array.isArray(resultRows) ? resultRows[0] : null;
  const status = typeof result?.status === "string" ? result.status : "db_update_failed";
  const detail = typeof result?.detail === "string" ? result.detail : undefined;

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  revalidatePath("/profile");
  revalidatePath(`/user/${user.id}`);

  const { data: post } = await supabase.schema("blog").from("posts").select("author_id").eq("id", postId).maybeSingle();
  if (post?.author_id) {
    revalidatePath(post.author_id === user.id ? "/profile" : `/user/${post.author_id}`);
  }

  if (status === "invested") {
    const summary = await getUserInvestmentSummary(supabase, user.id);
    redirect(appendInvestStatus(redirectTo, status, String(summary.availableToInvest)));
  }

  redirect(appendInvestStatus(redirectTo, status, detail));
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
      type: "comment_on_post" | "reply_to_comment" | "mention_in_comment";
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

    // Extract mentioned user IDs from comment body HTML
    const mentionRegex = /<span[^>]*data-type="mention"[^>]*data-id="([^"]+)"[^>]*>/g;
    const mentionedUserIds = new Set<string>();
    let match;
    while ((match = mentionRegex.exec(body)) !== null) {
      const userId = match[1];
      // if (userId && userId !== user.id && userId !== postAuthorId && userId !== parentCommentAuthorId) {
      if (userId) {
        mentionedUserIds.add(userId);
      }
    }

    // Create mention notifications
    for (const mentionedUserId of mentionedUserIds) {
      notifications.push({
        recipient_id: mentionedUserId,
        actor_id: user.id,
        type: "mention_in_comment",
        post_id: postId,
        comment_id: insertedComment.id,
        parent_comment_id: parentId,
      });
    }

    if (notifications.length) {
      let { data: insertedNotifications, error: insertNotificationsError } = await supabase
        .schema("blog")
        .from("notifications")
        .insert(notifications)
        .select("id, recipient_id, actor_id, type, post_id, comment_id");

      if (insertNotificationsError) {
        const admin = createAdminClient();
        if (admin) {
          const adminInsert = await admin
            .schema("blog")
            .from("notifications")
            .insert(notifications)
            .select("id, recipient_id, actor_id, type, post_id, comment_id");

          insertedNotifications = adminInsert.data;
          insertNotificationsError = adminInsert.error;
        }
      }

      if (insertedNotifications?.length) {
        await sendPushNotificationsForNotifications(insertedNotifications);
      }

      for (const notification of notifications) {
        revalidatePath(notification.recipient_id === user.id ? "/profile" : `/user/${notification.recipient_id}`);
      }
      revalidatePath("/notifications");
    }
  }

  // Check if Rei should respond to this comment
  const botUserId = process.env.BLOG_WRITER_BOT_USER_ID?.trim();
  const botEmail = process.env.BLOG_WRITER_AUTHOR_EMAIL?.trim() || "rei@astrorei.io";
  
  // Determine if this comment warrants a Rei response:
  // 1. Mentions "rei" directly
  // 2. Is a reply to Rei's comment
  // 3. Is a comment on Rei's post
  const mentionsRei = body.toLowerCase().includes("rei");
  const isReplyingToRei = parentCommentAuthorId === botUserId;
  const isCommentingOnReiPost = postOwner?.author_id === botUserId;
  
  const shouldCheckForResponse = botUserId && (mentionsRei || isReplyingToRei || isCommentingOnReiPost);
  
  if (shouldCheckForResponse) {
    try {
      // Fetch post content
      const { data: post } = await supabase
        .schema("blog")
        .from("posts")
        .select("id, title, content, author_id")
        .eq("id", postId)
        .single();

      if (post) {
        // Fetch comment thread (all comments in this post for context)
        const { data: allComments } = await supabase
          .schema("blog")
          .from("comments")
          .select("id, body, author_id, author_email, created_at, parent_id")
          .eq("post_id", postId)
          .order("created_at", { ascending: true });

        const commentChain = (allComments || []).map((c: { id: string; body: string; author_id: string; author_email: string; created_at: string }) => ({
          id: c.id,
          body: c.body,
          author: c.author_email,
          authorId: c.author_id,
          created_at: c.created_at,
        }));

        const decision = await shouldRespondToComment({
          commentId: insertedComment.id,
          commentBody: body,
          commentAuthor: user.email || "unknown",
          postId: post.id,
          postTitle: post.title,
          postContent: post.content,
          postAuthorId: post.author_id,
          parentCommentAuthorId: parentCommentAuthorId || undefined,
          commentChain,
        });

        if (decision.shouldRespond && decision.response) {
          console.log(`comment-responder: Rei will respond to comment ${insertedComment.id}`);
          
          const admin = createAdminClient();
          if (admin) {
            await admin
              .schema("blog")
              .from("comments")
              .insert({
                post_id: postId,
                parent_id: insertedComment.id,
                body: decision.response,
                author_id: botUserId,
                author_email: botEmail,
              });
          }
        } else {
          console.log(`comment-responder: Rei will not respond - ${decision.reasoning}`);
        }
      }
    } catch (error) {
      console.error("comment-responder: failed to process comment", error);
      // Don't block the user's comment - fail silently
    }
  }

  // Rei votes on comments based on quality/relevance
  if (botUserId && user.id !== botUserId) {
    try {
      const { data: post } = await supabase
        .schema("blog")
        .from("posts")
        .select("id, title, content, author_id")
        .eq("id", postId)
        .single();

      if (post) {
        const { data: allComments } = await supabase
          .schema("blog")
          .from("comments")
          .select("id, body, author_id, author_email, created_at, parent_id")
          .eq("post_id", postId)
          .order("created_at", { ascending: true });

        const commentChain = (allComments || []).map((c: { id: string; body: string; author_id: string; author_email: string; created_at: string }) => ({
          id: c.id,
          body: c.body,
          author: c.author_email,
          authorId: c.author_id,
          created_at: c.created_at,
        }));

        const voteDecision = await shouldVoteOnComment({
          commentBody: body,
          commentAuthor: user.email || "unknown",
          postId: post.id,
          postTitle: post.title,
          postContent: post.content,
          postAuthorId: post.author_id,
          parentCommentAuthorId: parentCommentAuthorId || undefined,
          commentChain,
        });

        if (voteDecision.shouldVote && voteDecision.vote) {
          console.log(`comment-voter: Rei will vote ${voteDecision.vote > 0 ? "+" : ""}${voteDecision.vote} on comment ${insertedComment.id} - ${voteDecision.reasoning}`);
          
          const admin = createAdminClient();
          if (admin) {
            // Insert or update vote
            await admin
              .schema("blog")
              .from("comment_votes")
              .upsert({
                comment_id: insertedComment.id,
                user_id: botUserId,
                vote: voteDecision.vote,
              }, {
                onConflict: "comment_id,user_id",
              });
          }
        } else {
          console.log(`comment-voter: Rei will not vote - ${voteDecision.reasoning}`);
        }
      }
    } catch (error) {
      console.error("comment-voter: failed to process vote", error);
      // Don't block the user's comment - fail silently
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
