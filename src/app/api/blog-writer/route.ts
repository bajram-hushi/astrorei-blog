import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedUser } from "@/lib/auth";
import { generateBlogPost } from "@/lib/blog-writer-agent";
import { evaluateAngelInvestment } from "@/lib/angel-investor";
import { sendNewPostEmail } from "@/lib/email";
import { marked } from "marked";

export const runtime = "nodejs";

export async function POST(request: Request) {
    // Support both cookie-based session and a shared secret for programmatic calls
    const secret = request.headers.get("x-blog-writer-secret");
    const configuredSecret = process.env.BLOG_WRITER_SECRET?.trim();
    const botUserId = process.env.BLOG_WRITER_BOT_USER_ID?.trim();

    if (!botUserId) {
        return NextResponse.json({ error: "BLOG_WRITER_BOT_USER_ID not configured" }, { status: 503 });
    }

    if (configuredSecret && secret === configuredSecret) {
    // Programmatic call — authenticated via shared secret, no further checks needed
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAllowedUser(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

    // Always attribute the post to the bot user from env
    const authorId = botUserId;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
  }

  const admin = createAdminClient();
    if (!admin) {
        return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    // Fetch recent posts and projects for context
    const [{ data: recentPosts }, { data: recentProjects }] = await Promise.all([
        admin
            .schema("blog")
            .from("posts")
            .select("title, content, content_format, created_at")
            .order("created_at", { ascending: false })
          .limit(8),
      admin
          .schema("blog")
          .from("projects")
          .select("id, title, summary, status")
          .order("created_at", { ascending: false })
          .limit(20),
  ]);

  const posts = (recentPosts ?? []).map((p: { title: string; content: string; content_format: string; created_at: string }) => ({
    title: p.title,
      content: p.content,
      contentFormat: p.content_format as "markdown" | "richtext",
      created_at: p.created_at,
  }));

    const projects = (recentProjects ?? []).map((p: { id: string; title: string; summary: string; status: string }) => ({
        id: p.id,
        title: p.title,
        summary: p.summary,
        status: p.status,
    }));

    console.log(`blog-writer route: fetched ${posts.length} posts and ${projects.length} projects`);

    const result = await generateBlogPost(posts, projects);

    if (!result) {
        console.error("blog-writer: generateBlogPost returned null - check logs for OpenAI errors");
        return NextResponse.json(
            { error: "Generation failed", detail: "AI generation returned no result. Check server logs for details." },
            { status: 502 }
        );
    }

    const authorEmail = process.env.BLOG_WRITER_AUTHOR_EMAIL?.trim() ?? "rei@astrorei.io";

    const richContent = await marked.parse(result.content, { async: true });

    const insertData = {
        title: result.title,
    content: richContent,
    content_format: "richtext",
        author_id: authorId,
        author_email: authorEmail,
    };

    const { data: newPost, error: insertError } = await admin
        .schema("blog")
    .from("posts")
        .insert(insertData)
        .select("id, title")
        .single();

    if (insertError || !newPost) {
    return NextResponse.json(
      { error: "Failed to save post", detail: insertError?.message },
      { status: 500 }
    );
  }

    // Link related projects returned by the agent
    const validProjectIds = result.related_project_ids.filter((id) =>
        projects.some((p) => p.id === id)
    );
    if (validProjectIds.length) {
        const linkRows = validProjectIds.map((projectId) => ({
            project_id: projectId,
            post_id: newPost.id,
            linked_by: authorId,
        }));
        await admin.schema("blog").from("project_posts").insert(linkRows);
    }

    // Run the same post-creation pipeline as a manual post
    try {
        await sendNewPostEmail({
            postId: newPost.id,
            title: newPost.title,
            authorEmail: authorEmail,
      preview: richContent,
    });
  } catch (emailError) {
    console.error("blog-writer: failed to send email", emailError);
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      const angelResult = await evaluateAngelInvestment({
        title: result.title,
        content: richContent,
        contentFormat: "richtext",
      });

      if (angelResult) {
        await admin
          .schema("blog")
          .from("posts")
          .update({
            investment_eur: angelResult.amountEur,
            investment_confidence: angelResult.confidence,
            investment_thesis: angelResult.thesis,
            investment_model: angelResult.model,
            investment_created_at: new Date().toISOString(),
          })
          .eq("id", newPost.id);
      }
    } catch (angelError) {
      console.error("blog-writer: angel evaluation failed", angelError);
    }
  }

  return NextResponse.json({ id: newPost.id, title: newPost.title });
}
