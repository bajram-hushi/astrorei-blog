import OpenAI from "openai";
import fs from "fs";
import path from "path";

type PostSummary = {
  title: string;
  content: string;
  contentFormat: "markdown" | "richtext";
  created_at: string;
};

type ProjectSummary = {
    id: string;
    title: string;
    summary: string;
    status: string;
};

export type BlogWriterResult = {
  title: string;
  content: string;
    related_project_ids: string[];
};

function clip(input: string, max = 6000): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}...[truncated]`;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function readDocFile(relativePath: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
  } catch {
    return "";
  }
}

export async function generateBlogPost(posts: PostSummary[], projects: ProjectSummary[]): Promise<BlogWriterResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

  if (!apiKey) {
    return null;
  }

  const client = new OpenAI({ apiKey, project: "proj_ehmvMgAWu3TwCfVLOtO8i7KV" });
  const recentPostsSummary = posts
    .slice(0, 8)
    .map((p, i) => {
      const body = p.contentFormat === "richtext" ? stripHtml(p.content) : p.content;
      return `--- Post ${i + 1} (${p.created_at.slice(0, 10)}) ---\nTitle: ${p.title}\nContent: ${clip(body, 800)}`;
    })
    .join("\n\n");

    const projectsSummary = projects
        .map((p) => `- id:${p.id} | "${p.title}" [${p.status}]: ${clip(stripHtml(p.summary), 200)}`)
        .join("\n");

  const systemPrompt = [
      "You are a product writer and builder.",
      "You write blog posts about digital project ideas that could be vibecoded — small, focused apps or tools",
      "that a solo developer or small team could ship quickly using modern AI-assisted coding.",
    "",
      "Your task: come up with ONE concrete digital project idea worth building and write a compelling internal blog post about it.",
    "",
    "Rules for the idea:",
      "- Can be any type of digital product: SaaS tool, CLI, browser extension, API, automation, niche app, internal tool, etc.",
      "- Must be buildable end-to-end in days to a few weeks by a single developer using AI (vibecoding)",
      "- Must have real, specific value for a clear audience",
      "- NOT a generic rehash (e.g. 'another todo app', 'another AI chatbot')",
      "- Can take inspiration from existing posts or projects provided — but must add something new or go deeper",
      "- Should feel like a genuine idea someone at a small product studio would get excited to ship",
    "",
    "Rules for the blog post:",
      "- Language: Italian",
      "- Tone: direct, practical, slightly opinionated — written by a builder for builders",
      "- Structure: short intro → problem → what we're building → how it works → why it's worth shipping → next steps",
    "- Length: 350–600 words",
    "- Format: Markdown with ## headings",
    "",
      "If the idea is clearly related to one or more of the existing projects provided, include their IDs.",
      "",
    "Return ONLY strict JSON with this shape:",
      '{ "title": "...", "content": "...", "related_project_ids": ["uuid", ...] }',
      "related_project_ids must be an array (empty if no relevant projects).",
    "No markdown wrapper, no explanation, no preamble.",
  ].join("\n");

    const userPrompt = [
    "",
      "## Existing Projects (for reference and linking)",
      projectsSummary || "(no projects yet)",
    "",
    "## Recent Blog Posts (for style and topic reference)",
    recentPostsSummary || "(no posts yet)",
  ].join("\n");

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;

      const parsed = JSON.parse(raw) as { title?: string; content?: string; related_project_ids?: unknown };
    if (!parsed.title || !parsed.content) return null;

      const relatedIds = Array.isArray(parsed.related_project_ids)
          ? (parsed.related_project_ids as unknown[]).filter((x): x is string => typeof x === "string")
          : [];

      return { title: parsed.title, content: parsed.content, related_project_ids: relatedIds };
  } catch {
    return null;
  }
}
