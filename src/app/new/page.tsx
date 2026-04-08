import Link from "next/link";
import { redirect } from "next/navigation";
import { createPost } from "@/app/actions";
import { Header } from "@/components/header";
import { PostEditorFields } from "@/components/post-editor-fields";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";

type Props = {
  searchParams: Promise<{ error?: string; detail?: string }>;
};

function toErrorMessage(code?: string, detail?: string) {
  if (detail?.toLowerCase().includes("invalid schema: blog")) {
    return "Supabase API does not expose schema 'blog'. In Supabase Dashboard -> Settings -> API -> Exposed schemas, add 'blog', then retry.";
  }

  switch (code) {
    case "missing_fields":
      return "Please add both title and content before publishing.";
    case "invalid_content_format":
      return "Invalid content format selected.";
    case "create_post_failed":
      return detail
        ? `Could not create the post: ${detail}`
        : "Could not create the post. Check Supabase schema and RLS policies, then try again.";
    case "project_link_failed":
      return detail
        ? `Post was created but linking projects failed: ${detail}`
        : "Post was created but linking selected projects failed.";
    default:
      return code ? `Error: ${code}` : "";
  }
}

export default async function NewPostPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedUser(user)) {
    redirect("/login");
  }

  const { data: projects } = await supabase
    .schema("blog")
    .from("projects")
    .select("id, title, status")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New Post</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Write for your internal team using markdown or rich text.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-700 hover:underline">
            Back to posts
          </Link>
        </div>

        {params.error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {toErrorMessage(params.error, params.detail)}
          </p>
        )}

        <form
          action={createPost}
          className="space-y-6 rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-sm md:p-8"
        >
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Title</span>
            <input
              name="title"
              required
              maxLength={140}
              placeholder="Example: Launch notes for internal API v2"
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-lg"
            />
          </label>

          <PostEditorFields />

          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-700">Link to projects (optional)</p>
            {!!projects?.length && (
              <div className="space-y-2">
                {projects.map((project) => (
                  <label key={project.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
                    <span>{project.title}</span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600">{project.status}</span>
                      <input type="checkbox" name="project_ids" value={project.id} className="h-4 w-4" />
                    </span>
                  </label>
                ))}
              </div>
            )}
            {!projects?.length && <p className="text-xs text-zinc-600">No projects yet. Create one from the Projects page.</p>}
          </div>

          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Publish Post
          </button>
        </form>
      </main>
    </div>
  );
}
