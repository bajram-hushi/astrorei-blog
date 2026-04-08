import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { createProject } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { PostEditorFields } from "@/components/post-editor-fields";
import { ProjectImageField } from "@/components/project-image-field";

type Props = {
  searchParams: Promise<{ error?: string; detail?: string }>;
};

const PROJECT_STATUSES = ["idea", "concept", "validation", "building", "launched", "archived"];

function toErrorMessage(code?: string, detail?: string) {
  if (detail?.includes("Could not find the table 'blog.projects' in the schema cache")) {
    return "Supabase API cannot see blog.projects yet. Apply supabase/blog_schema.sql to your DB, verify 'blog' is in Settings -> API -> Exposed schemas, then run: NOTIFY pgrst, 'reload schema';";
  }

  switch (code) {
    case "missing_fields":
      return "Please add title and summary.";
    case "invalid_status":
      return "Invalid project status selected.";
    case "invalid_summary_format":
      return "Invalid summary format selected.";
    case "invalid_summary_length":
      return detail ? `Summary is too long. Maximum length is ${detail} characters.` : "Summary is too long.";
    case "create_project_failed":
      return detail ? `Could not create project: ${detail}` : "Could not create project.";
    default:
      return code ? `Error: ${code}` : "";
  }
}

export default async function NewProjectPage({ searchParams }: Props) {
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
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Create Project</h1>
            <p className="text-sm text-zinc-600">Define a project concept and evolve it through clear statuses.</p>
          </div>
          <Link href="/projects" className="text-sm text-zinc-700 hover:underline">
            Back to projects
          </Link>
        </div>

        {params.error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {toErrorMessage(params.error, params.detail)}
          </p>
        )}

        <form action={createProject} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Title</span>
            <input
              name="title"
              required
              maxLength={140}
              placeholder="Example: AI-assisted lead scoring"
              className="w-full rounded-lg border border-zinc-300 px-4 py-2"
            />
          </label>

          <div className="space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Summary</span>
            <PostEditorFields
              contentFieldName="summary"
              contentFormatFieldName="summary_format"
              placeholder="Describe the project concept, expected value, and key assumptions."
            />
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Status</span>
            <select name="status" defaultValue="idea" className="w-full rounded-lg border border-zinc-300 px-4 py-2">
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ProjectImageField />
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-zinc-700">Website URL (optional)</span>
              <input
                name="website_url"
                type="url"
                placeholder="https://example.com"
                className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-zinc-700">GitHub Repo URL (optional)</span>
              <input
                name="github_repo_url"
                type="url"
                placeholder="https://github.com/org/repo"
                className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              />
            </label>
          </div>

          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            Create Project
          </button>
        </form>
      </main>
    </div>
  );
}
