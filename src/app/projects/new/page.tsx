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
    return "L'API Supabase non vede ancora blog.projects. Applica supabase/blog_schema.sql al tuo DB, verifica che 'blog' sia in Settings -> API -> Exposed schemas, poi esegui: NOTIFY pgrst, 'reload schema';";
  }

  switch (code) {
    case "missing_fields":
      return "Aggiungi titolo e riepilogo.";
    case "invalid_status":
      return "Stato del progetto non valido.";
    case "invalid_summary_format":
      return "Formato riepilogo non valido.";
    case "invalid_summary_length":
      return detail ? `Il riepilogo è troppo lungo. Lunghezza massima: ${detail} caratteri.` : "Il riepilogo è troppo lungo.";
    case "create_project_failed":
      return detail ? `Impossibile creare il progetto: ${detail}` : "Impossibile creare il progetto.";
    default:
      return code ? `Errore: ${code}` : "";
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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Crea progetto</h1>
            <p className="text-sm text-zinc-600">Definisci un concept di progetto e fallo evolvere attraverso stati chiari.</p>
          </div>
          <Link href="/projects" className="inline-flex w-fit text-sm text-zinc-700 hover:underline">
            Torna ai progetti
          </Link>
        </div>

        {params.error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {toErrorMessage(params.error, params.detail)}
          </p>
        )}

        <form action={createProject} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Titolo</span>
            <input
              name="title"
              required
              maxLength={140}
              placeholder="Esempio: Scoring lead con AI"
              className="w-full rounded-lg border border-zinc-300 px-4 py-2"
            />
          </label>

          <div className="space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Riepilogo</span>
            <PostEditorFields
              contentFieldName="summary"
              contentFormatFieldName="summary_format"
              placeholder="Descrivi il concept del progetto, il valore atteso e le ipotesi chiave."
            />
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Stato</span>
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
              <span className="text-sm font-semibold text-zinc-700">URL sito web (opzionale)</span>
              <input
                name="website_url"
                type="url"
                placeholder="https://example.com"
                className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-zinc-700">URL repo GitHub (opzionale)</span>
              <input
                name="github_repo_url"
                type="url"
                placeholder="https://github.com/org/repo"
                className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              />
            </label>
          </div>

          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            Crea progetto
          </button>
        </form>
      </main>
    </div>
  );
}
