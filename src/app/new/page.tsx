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
    return "L'API Supabase non espone lo schema 'blog'. In Supabase Dashboard -> Settings -> API -> Exposed schemas, aggiungi 'blog' e riprova.";
  }

  switch (code) {
    case "missing_fields":
      return "Aggiungi titolo e contenuto prima di pubblicare.";
    case "invalid_content_format":
      return "Formato contenuto non valido.";
    case "create_post_failed":
      return detail
        ? `Impossibile creare il post: ${detail}`
        : "Impossibile creare il post. Controlla lo schema Supabase e le policy RLS, poi riprova.";
    case "project_link_failed":
      return detail
        ? `Post creato ma il collegamento ai progetti è fallito: ${detail}`
        : "Post creato ma il collegamento ai progetti selezionati è fallito.";
    default:
      return code ? `Errore: ${code}` : "";
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
      <main className="mx-auto w-full max-w-350 px-4 py-10 md:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Crea nuovo post</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Scrivi per il tuo team interno con markdown o testo arricchito.
            </p>
          </div>
          <Link href="/" className="inline-flex w-fit text-sm text-zinc-700 hover:underline">
            Torna ai post
          </Link>
        </div>

        {params.error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {toErrorMessage(params.error, params.detail)}
          </p>
        )}

        <form
          action={createPost}
          className="space-y-6 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-sm sm:p-6 md:p-8"
        >
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-zinc-700">Titolo</span>
            <input
              name="title"
              required
              maxLength={140}
              placeholder="Esempio: Note di lancio per API interna v2"
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-lg"
            />
          </label>

          <PostEditorFields />

          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-700">Collega a progetti (opzionale)</p>
            {!!projects?.length && (
              <div className="space-y-2">
                {projects.map((project) => (
                  <label key={project.id} className="flex flex-col items-start gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span>{project.title}</span>
                    <span className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600">{project.status}</span>
                      <input type="checkbox" name="project_ids" value={project.id} className="h-4 w-4" />
                    </span>
                  </label>
                ))}
              </div>
            )}
            {!projects?.length && <p className="text-xs text-zinc-600">Nessun progetto ancora. Creane uno dalla pagina Progetti.</p>}
          </div>

          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Pubblica post
          </button>
        </form>
      </main>
    </div>
  );
}
