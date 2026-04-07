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
