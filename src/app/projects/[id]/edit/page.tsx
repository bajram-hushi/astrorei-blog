import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/header";
import { updateProjectDetails } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { PostEditorFields } from "@/components/post-editor-fields";
import { ProjectImageField } from "@/components/project-image-field";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; detail?: string }>;
};

function toErrorMessage(code?: string, detail?: string) {
  switch (code) {
    case "missing_project_fields":
      return "Please provide title and summary.";
    case "invalid_summary_format":
      return "Invalid summary format submitted.";
    case "invalid_summary_length":
      return detail ? `Summary is too long. Maximum length is ${detail} characters.` : "Summary is too long.";
    case "project_update_failed":
      return detail ? `Could not update project: ${detail}` : "Could not update project.";
    case "project_edit_history_failed":
      return detail ? `Project updated but history insert failed: ${detail}` : "Project edit history failed.";
    default:
      return code ? `Error: ${code}` : "";
  }
}

export default async function EditProjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedUser(user)) {
    redirect("/login");
  }

  const projectResult = await supabase
    .schema("blog")
    .from("projects")
    .select("id, owner_user_id, title, summary, summary_format, image_url, website_url, github_repo_url")
    .eq("id", id)
    .maybeSingle();

  let project = projectResult.data;

  if (!project && projectResult.error?.message?.toLowerCase().includes("summary_format")) {
    const legacyResult = await supabase
      .schema("blog")
      .from("projects")
      .select("id, owner_user_id, title, summary, image_url, website_url, github_repo_url")
      .eq("id", id)
      .maybeSingle();

    if (legacyResult.data) {
      project = {
        ...legacyResult.data,
        summary_format: "richtext",
      };
    }
  }

  if (!project && projectResult.error && !projectResult.error.message?.toLowerCase().includes("summary_format")) {
    const detail = encodeURIComponent(projectResult.error.message || projectResult.error.code || "project_query_failed");
    redirect(`/projects?error=project_query_failed&detail=${detail}`);
  }

  if (!project) {
    notFound();
  }

  if (!user || project.owner_user_id !== user.id) {
    redirect(`/projects/${id}?error=forbidden`);
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Edit Project</h1>
            <p className="text-sm text-zinc-600">Only project owner can update details.</p>
          </div>
          <Link href={`/projects/${project.id}`} className="text-sm text-zinc-700 hover:underline">
            Back to project
          </Link>
        </div>

        {query.error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {toErrorMessage(query.error, query.detail)}
          </p>
        )}

        <form action={updateProjectDetails} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6">
          <input type="hidden" name="project_id" value={project.id} />

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Title</span>
            <input
              name="title"
              required
              maxLength={140}
              defaultValue={project.title}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2"
            />
          </label>

          <div className="space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Summary</span>
            <PostEditorFields
              contentFieldName="summary"
              contentFormatFieldName="summary_format"
              initialContent={project.summary}
              placeholder="Describe the project concept, expected value, and key assumptions."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ProjectImageField defaultValue={project.image_url ?? ""} />
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-zinc-700">Website URL (optional)</span>
              <input
                name="website_url"
                type="url"
                defaultValue={project.website_url ?? ""}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-zinc-700">GitHub Repo URL (optional)</span>
              <input
                name="github_repo_url"
                type="url"
                defaultValue={project.github_repo_url ?? ""}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Edit Note (optional)</span>
            <input
              name="edit_note"
              maxLength={500}
              placeholder="Why was this edit made?"
              className="w-full rounded-lg border border-zinc-300 px-4 py-2"
            />
          </label>

          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            Save Changes
          </button>
        </form>
      </main>
    </div>
  );
}
