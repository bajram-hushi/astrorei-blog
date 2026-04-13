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
      return "Aggiungi titolo e riepilogo.";
    case "invalid_summary_format":
      return "Formato riepilogo non valido.";
    case "invalid_summary_length":
      return detail ? `Il riepilogo è troppo lungo. Lunghezza massima: ${detail} caratteri.` : "Il riepilogo è troppo lungo.";
    case "project_update_failed":
      return detail ? `Impossibile aggiornare il progetto: ${detail}` : "Impossibile aggiornare il progetto.";
    case "project_edit_history_failed":
      return detail ? `Progetto aggiornato ma il salvataggio dello storico è fallito: ${detail}` : "Salvataggio storico modifiche fallito.";
    default:
      return code ? `Errore: ${code}` : "";
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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Modifica progetto</h1>
            <p className="text-sm text-zinc-600">Solo il proprietario del progetto può aggiornare i dettagli.</p>
          </div>
          <Link href={`/projects/${project.id}`} className="inline-flex w-fit text-sm text-zinc-700 hover:underline">
            Torna al progetto
          </Link>
        </div>

        {query.error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {toErrorMessage(query.error, query.detail)}
          </p>
        )}

        <form action={updateProjectDetails} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
          <input type="hidden" name="project_id" value={project.id} />

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Titolo</span>
            <input
              name="title"
              required
              maxLength={140}
              defaultValue={project.title}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2"
            />
          </label>

          <div className="space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Riepilogo</span>
            <PostEditorFields
              contentFieldName="summary"
              contentFormatFieldName="summary_format"
              initialContent={project.summary}
              placeholder="Descrivi il concept del progetto, il valore atteso e le ipotesi chiave."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ProjectImageField defaultValue={project.image_url ?? ""} />
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-zinc-700">URL sito web (opzionale)</span>
              <input
                name="website_url"
                type="url"
                defaultValue={project.website_url ?? ""}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-zinc-700">URL repo GitHub (opzionale)</span>
              <input
                name="github_repo_url"
                type="url"
                defaultValue={project.github_repo_url ?? ""}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Nota di modifica (opzionale)</span>
            <input
              name="edit_note"
              maxLength={500}
              placeholder="Perché è stata effettuata questa modifica?"
              className="w-full rounded-lg border border-zinc-300 px-4 py-2"
            />
          </label>

          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            Salva modifiche
          </button>
        </form>
      </main>
    </div>
  );
}
