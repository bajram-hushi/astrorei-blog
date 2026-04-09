import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { evaluatePostInvestment } from "@/app/actions";
import { Header } from "@/components/header";
import { PostContent } from "@/components/post-content";
import { CommentsAndInvestments } from "@/components/comments-and-investments";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { formatEurCompact } from "@/lib/currency";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; detail?: string; eval_status?: string; eval_detail?: string; invest_status?: string; invest_detail?: string }>;
};

export const revalidate = 30;

function evalMessage(status?: string, detail?: string) {
  switch (status) {
    case "evaluated":
      return { tone: "success", text: "Valutazione angel investor completata." } as const;
    case "already_evaluated":
      return { tone: "info", text: "Questo post è già stato valutato." } as const;
    case "missing_openai_key":
      return { tone: "error", text: "OPENAI_API_KEY mancante. Aggiungila all'ambiente e riprova." } as const;
    case "evaluation_failed":
      return { tone: "error", text: "Valutazione OpenAI fallita. Controlla il modello/chiave e riprova." } as const;
    case "db_update_failed":
      return { tone: "error", text: detail ? `Impossibile salvare la valutazione: ${detail}` : "Impossibile salvare la valutazione." } as const;
    default:
      return null;
  }
}

function investMessage(status?: string, detail?: string) {
  switch (status) {
    case "invested":
      return {
        tone: "success",
        text: detail ? `Investimento effettuato. Saldo rimanente: EUR ${formatEurCompact(Number(detail))}.` : "Investimento effettuato.",
      } as const;
    case "insufficient_funds":
      return {
        tone: "error",
        text: `Saldo insufficiente. Puoi investire fino a EUR ${formatEurCompact(Number(detail ?? 0))}.`,
      } as const;
    case "own_post":
      return { tone: "error", text: "Non puoi investire nel tuo stesso post." } as const;
    case "invalid_amount":
      return { tone: "error", text: "Inserisci un importo di investimento positivo." } as const;
    case "missing_post_id":
      return { tone: "error", text: "ID post mancante per l'investimento." } as const;
    case "post_not_found":
      return { tone: "error", text: "Post non trovato per l'investimento." } as const;
    case "db_update_failed":
      return { tone: "error", text: detail ? `Impossibile salvare l'investimento: ${detail}` : "Impossibile salvare l'investimento." } as const;
    default:
      return null;
  }
}

export default async function PostPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const evalState = evalMessage(query.eval_status, query.eval_detail);
  const investState = investMessage(query.invest_status, query.invest_detail);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    redirect("/login");
  }

  const { data: post } = await supabase
    .schema("blog")
    .from("posts")
    .select("id, title, content, content_format, created_at, author_id, author_email, investment_eur, investment_confidence, investment_thesis")
    .eq("id", id)
    .single();

  if (!post) {
    notFound();
  }

  const { data: authorProfile } = await supabase
    .schema("blog")
    .from("profiles")
    .select("id, email, username, avatar_url")
    .eq("id", post.author_id)
    .single();

  const { data: projectLinks } = await supabase
    .schema("blog")
    .from("project_posts")
    .select("project_id, projects(id, title, status)")
    .eq("post_id", post.id);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        {evalState && (
          <p
            className={`mb-4 rounded-md border p-3 text-sm ${
              evalState.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : evalState.tone === "info"
                  ? "border-zinc-200 bg-zinc-50 text-zinc-700"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {evalState.text}
          </p>
        )}
        {investState && (
          <p
            className={`mb-4 rounded-md border p-3 text-sm ${
              investState.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {investState.text}
          </p>
        )}
        <article className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
            <Link
              href={post.author_id === user?.id ? "/profile" : `/user/${post.author_id}`}
              className="flex items-center gap-1.5 hover:underline"
            >
              {authorProfile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={authorProfile.avatar_url}
                  alt="Avatar autore"
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-300 text-xs font-semibold text-zinc-700">
                  {(authorProfile?.username ?? post.author_email ?? "u")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
              )}
              <span>{authorProfile?.username ?? post.author_email}</span>
            </Link>
            <span className="text-zinc-400">{new Date(post.created_at).toLocaleString()}</span>
          </div>
          <div className="mt-6">
            <PostContent
              content={post.content}
              format={post.content_format as "markdown" | "richtext"}
            />
          </div>
          {!!projectLinks?.length && (
            <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Progetti collegati</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {projectLinks.map((link) => {
                  const project = Array.isArray(link.projects) ? link.projects[0] : link.projects;
                  if (!project) {
                    return null;
                  }

                  return (
                    <Link
                      key={link.project_id}
                      href={`/projects/${project.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                    >
                      <span>{project.title}</span>
                      <span className="text-zinc-500">{project.status}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {post.investment_eur !== null && post.investment_eur !== undefined && (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Decisione Angel Investor</p>
              <p className="mt-1 text-lg font-bold text-emerald-900">
                EUR {formatEurCompact(post.investment_eur)}
                {post.investment_confidence ? ` (${post.investment_confidence}% confidenza)` : ""}
              </p>
              {post.investment_thesis && (
                <p className="mt-1 text-sm text-emerald-900/85">{post.investment_thesis}</p>
              )}
            </div>
          )}
          {(post.investment_eur === null || post.investment_eur === undefined) && (
            <form action={evaluatePostInvestment} className="mt-6">
              <input type="hidden" name="post_id" value={post.id} />
              <input type="hidden" name="redirect_to" value={`/post/${post.id}`} />
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Valuta con Angel Investor
              </button>
            </form>
          )}
        </article>

        <CommentsAndInvestments postId={post.id} postAuthorId={post.author_id} userId={user.id} />
      </main>
    </div>
  );
}
