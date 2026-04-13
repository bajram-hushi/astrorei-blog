import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { ProjectStatusDialog } from "@/components/project-status-dialog";
import { PostContent } from "@/components/post-content";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; detail?: string; status_updated?: string; project_updated?: string }>;
};

function statusMessage(statusUpdated?: string, projectUpdated?: string, error?: string, detail?: string) {
  if (error) {
    return {
      tone: "error" as const,
      text: detail ? `Azione fallita: ${detail}` : `Azione fallita: ${error}`,
    };
  }

  if (statusUpdated === "1") {
    return {
      tone: "success" as const,
      text: "Stato del progetto aggiornato.",
    };
  }

  if (statusUpdated === "0") {
    return {
      tone: "info" as const,
      text: "Stato invariato.",
    };
  }

  if (projectUpdated === "1") {
    return {
      tone: "success" as const,
      text: "Dettagli del progetto aggiornati.",
    };
  }

  if (projectUpdated === "0") {
    return {
      tone: "info" as const,
      text: "Nessuna modifica rilevata nei dettagli del progetto.",
    };
  }

  return null;
}

function asStringRecord(value: unknown): Record<string, string | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>).map(([key, raw]) => {
    if (raw === null) {
      return [key, null] as const;
    }

    if (typeof raw === "string") {
      return [key, raw] as const;
    }

    return [key, String(raw)] as const;
  });

  return Object.fromEntries(entries);
}

function fieldLabel(field: string) {
  switch (field) {
    case "website_url":
      return "Sito web";
    case "github_repo_url":
      return "GitHub";
    case "summary_format":
      return "Formato riepilogo";
    case "image_url":
      return "Immagine card";
    case "title":
      return "Titolo";
    case "summary":
      return "Riepilogo";
    default:
      return field.replace(/_/g, " ");
  }
}

function compactValue(value: string | null | undefined) {
  const raw = (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) {
    return "(empty)";
  }
  if (raw.length <= 80) {
    return raw;
  }
  return `${raw.slice(0, 77)}...`;
}

export default async function ProjectDetailPage({ params, searchParams }: Props) {
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
    .select("id, title, summary, summary_format, status, image_url, website_url, github_repo_url, owner_user_id, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  let project = projectResult.data;

  if (!project && projectResult.error?.message?.toLowerCase().includes("summary_format")) {
    const legacyResult = await supabase
      .schema("blog")
      .from("projects")
      .select("id, title, summary, status, image_url, website_url, github_repo_url, owner_user_id, created_at, updated_at")
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

  const { data: owner } = await supabase
    .schema("blog")
    .from("profiles")
    .select("id, username, email")
    .eq("id", project.owner_user_id)
    .maybeSingle();

  const { data: links } = await supabase
    .schema("blog")
    .from("project_posts")
    .select("post_id, created_at, posts(id, title, created_at, author_id)")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  const { data: history } = await supabase
    .schema("blog")
    .from("project_status_history")
    .select("id, from_status, to_status, rationale, changed_by, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: editHistory } = await supabase
    .schema("blog")
    .from("project_edit_history")
    .select("id, changed_fields, previous_values, new_values, note, edited_by, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const historyUserIds = Array.from(new Set((history ?? []).map((item) => item.changed_by)));
  const editUserIds = Array.from(new Set((editHistory ?? []).map((item) => item.edited_by)));
  const allHistoryUserIds = Array.from(new Set([...historyUserIds, ...editUserIds]));
  const { data: historyUsers } = allHistoryUserIds.length
    ? await supabase
        .schema("blog")
        .from("profiles")
        .select("id, username, email")
        .in("id", allHistoryUserIds)
    : { data: [] as Array<{ id: string; username: string | null; email: string }> };

  const historyUserMap = new Map((historyUsers ?? []).map((profile) => [profile.id, profile]));

  const state = statusMessage(query.status_updated, query.project_updated, query.error, query.detail);
  const canEdit = user?.id === project.owner_user_id;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {state && (
          <p
            className={`mb-4 rounded-md border p-3 text-sm ${
              state.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : state.tone === "info"
                  ? "border-zinc-200 bg-zinc-50 text-zinc-700"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {state.text}
          </p>
        )}

        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Proprietario: {owner?.username ?? owner?.email ?? "Sconosciuto"} · Creato il {new Date(project.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {canEdit && (
              <>
                <Link
                  href={`/projects/${project.id}/edit`}
                  className="inline-flex w-full justify-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 sm:w-auto"
                >
                  Modifica dettagli progetto
                </Link>
                <ProjectStatusDialog projectId={project.id} currentStatus={project.status} />
              </>
            )}
            <Link href="/projects" className="inline-flex w-fit text-sm text-zinc-700 hover:underline">
              Torna ai progetti
            </Link>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
            {project.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.image_url}
                alt={`Copertina ${project.title}`}
                className="mb-4 h-44 w-full rounded-lg object-cover sm:h-56"
              />
            )}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Riepilogo</h2>
              <span className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700">
                {project.status}
              </span>
            </div>
            <div className="text-sm text-zinc-700">
              <PostContent
                content={project.summary}
                format={project.summary_format as "markdown" | "richtext"}
              />
            </div>

            <div className="mt-4 space-y-1 text-sm">
              {project.website_url && (
                <p>
                  Sito web: <a href={project.website_url} target="_blank" rel="noreferrer" className="break-all text-zinc-900 underline">{project.website_url}</a>
                </p>
              )}
              {project.github_repo_url && (
                <p>
                  GitHub: <a href={project.github_repo_url} target="_blank" rel="noreferrer" className="break-all text-zinc-900 underline">{project.github_repo_url}</a>
                </p>
              )}
            </div>

          </section>

          <section className="min-w-0 space-y-6">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
              <h2 className="text-lg font-semibold">Post collegati</h2>
              <div className="mt-3 space-y-3">
                {links?.map((link) => {
                  const post = Array.isArray(link.posts) ? link.posts[0] : link.posts;
                  if (!post) {
                    return null;
                  }

                  return (
                    <div key={link.post_id} className="rounded-md border border-zinc-200 p-3">
                      <Link href={`/post/${post.id}`} className="text-sm font-semibold hover:underline">
                        {post.title}
                      </Link>
                      <p className="mt-1 text-xs text-zinc-500">Collegato il {new Date(link.created_at).toLocaleDateString()}</p>
                    </div>
                  );
                })}

                {!links?.length && <p className="text-sm text-zinc-600">Nessun post collegato ancora.</p>}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
              <h2 className="text-lg font-semibold">Storico stati</h2>
              <div className="mt-3 space-y-3">
                {history?.map((entry) => {
                  return (
                    <div key={entry.id} className="rounded-md border border-zinc-200 p-3">
                      <p className="text-sm font-medium text-zinc-800">
                        {entry.from_status ?? "nessuno"}{" -> "}{entry.to_status}
                      </p>
                      {entry.rationale && <p className="mt-1 text-sm text-zinc-700">{entry.rationale}</p>}
                      <p className="mt-1 text-xs text-zinc-500">
                        {historyUserMap.get(entry.changed_by)?.username ?? historyUserMap.get(entry.changed_by)?.email ?? "Sconosciuto"} · {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  );
                })}

                {!history?.length && <p className="text-sm text-zinc-600">Nessuno storico stati ancora.</p>}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
              <h2 className="text-lg font-semibold">Storico modifiche</h2>
              <div className="mt-3 space-y-3">
                {editHistory?.map((entry) => {
                  const editedBy = historyUserMap.get(entry.edited_by);
                  const previousValues = asStringRecord(entry.previous_values);
                  const nextValues = asStringRecord(entry.new_values);
                  const changedFields = Array.isArray(entry.changed_fields) ? entry.changed_fields : [];

                  return (
                    <div key={entry.id} className="rounded-md border border-zinc-200 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium text-zinc-800">
                          {changedFields.length} campo{changedFields.length === 1 ? "" : "i"} aggiornato{changedFields.length === 1 ? "" : "i"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {historyUserMap.get(entry.edited_by)?.username ?? historyUserMap.get(entry.edited_by)?.email ?? "Sconosciuto"} · {new Date(entry.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!!changedFields.length && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {changedFields.map((field) => (
                            <span
                              key={field}
                              className="rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700"
                            >
                              {fieldLabel(field)}
                            </span>
                          ))}
                        </div>
                      )}
                      {entry.note && <p className="mt-2 text-sm text-zinc-700">Nota: {entry.note}</p>}

                      {!!changedFields.length && (
                        <details className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                          <summary className="cursor-pointer text-xs font-medium text-zinc-700">Visualizza modifiche</summary>
                          <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                            {changedFields.map((field) => (
                              <li key={field}>
                                <span className="font-medium">{fieldLabel(field)}:</span>{" "}
                                {compactValue(previousValues[field])}{" -> "}{compactValue(nextValues[field])}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  );
                })}

                {!editHistory?.length && <p className="text-sm text-zinc-600">Nessuno storico modifiche ancora.</p>}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
