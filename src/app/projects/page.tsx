import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";

function summaryPreview(summary: string) {
  const plain = summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= 180) {
    return plain;
  }
  return `${plain.slice(0, 177)}...`;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; status?: string }>;
}) {
  const { user: selectedUserId, status: selectedStatus } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedUser(user)) {
    redirect("/login");
  }

  const { data: allProjects } = await supabase
    .schema("blog")
    .from("projects")
    .select("id, title, summary, image_url, status, owner_user_id, created_at")
    .order("created_at", { ascending: false });

  const ownerIds = Array.from(new Set((allProjects ?? []).map((p) => p.owner_user_id)));
  const { data: owners } = ownerIds.length
    ? await supabase
        .schema("blog")
        .from("profiles")
        .select("id, username, email")
        .in("id", ownerIds)
    : { data: [] as Array<{ id: string; username: string | null; email: string }> };

  const ownerMap = new Map((owners ?? []).map((owner) => [owner.id, owner]));

  const userCounts = ownerIds
    .map((id) => ({
      id,
      count: (allProjects ?? []).filter((p) => p.owner_user_id === id).length,
    }))
    .sort((a, b) => b.count - a.count);

  const allStatuses = Array.from(new Set((allProjects ?? []).map((p) => p.status))).sort();
  const statusCounts = allStatuses.map((s) => ({
    status: s,
    count: (allProjects ?? []).filter((p) => p.status === s).length,
  }));

  const projects = (allProjects ?? []).filter((p) => {
    if (selectedUserId && p.owner_user_id !== selectedUserId) return false;
    if (selectedStatus && p.status !== selectedStatus) return false;
    return true;
  });

  const selectedUserName = selectedUserId
    ? (ownerMap.get(selectedUserId)?.username ??
      ownerMap.get(selectedUserId)?.email ??
      "Utente")
    : null;

  function buildUrl(params: { user?: string; status?: string }) {
    const qs = new URLSearchParams();
    if (params.user) qs.set("user", params.user);
    if (params.status) qs.set("status", params.status);
    return `/projects${qs.size ? `?${qs}` : ""}`;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Progetti</h1>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex shrink-0 rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700"
          >
            Nuovo progetto
          </Link>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="order-2 min-w-0 flex-1 lg:order-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {projects.map((project) => {
                const owner = ownerMap.get(project.owner_user_id);
                return (
                  <article
                    key={project.id}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                  >
                    <Link href={`/projects/${project.id}`} className="block">
                      {project.image_url ? (
                        <div className="aspect-video w-full bg-zinc-100 p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={project.image_url}
                            alt={`Copertina ${project.title}`}
                            className="h-full w-full rounded-md object-contain"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video w-full bg-linear-to-br from-zinc-100 via-zinc-200 to-zinc-300" />
                      )}
                    </Link>
                    <div className="min-w-0 p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <Link
                          href={`/projects/${project.id}`}
                          className="min-w-0 flex-1 truncate text-lg font-semibold hover:underline"
                        >
                          {project.title}
                        </Link>
                        <span className="shrink-0 rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700">
                          {project.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-700">
                        {summaryPreview(project.summary)}
                      </p>
                      <p className="mt-3 truncate text-xs text-zinc-500">
                        Proprietario:{" "}
                        {owner?.username ?? owner?.email ?? "Sconosciuto"} ·{" "}
                        {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </article>
                );
              })}

              {!projects.length && (
                <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-600">
                  Nessun progetto ancora. Crea il tuo primo concept di progetto.
                </p>
              )}
            </div>
          </div>

          <aside className="order-1 w-full shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm lg:order-2 lg:w-72">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
                <span>Filtri e risultati</span>
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {projects.length}
                </span>
              </summary>

              <div className="mt-3 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-800">
                    {projects.length} risultati
                  </span>
                  {selectedUserName && (
                    <span className="max-w-full truncate rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      Utente: {selectedUserName}
                    </span>
                  )}
                  {selectedStatus && (
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      Stato: {selectedStatus}
                    </span>
                  )}
                  {(selectedUserId || selectedStatus) && (
                    <Link
                      href="/projects"
                      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 sm:ml-auto"
                    >
                      Reset filtri
                    </Link>
                  )}
                </div>

                <section className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-2">
                  <h3 className="px-1 text-sm font-semibold text-zinc-700">
                    Filtra per utente
                  </h3>
                  <ul className="mt-3 space-y-1">
                    <li>
                      <Link
                        href={buildUrl({ status: selectedStatus })}
                        className={`flex min-w-0 items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                          !selectedUserId
                            ? "bg-zinc-900 font-medium text-white"
                            : "text-zinc-600 hover:bg-zinc-100"
                        }`}
                      >
                        <span>Tutti</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            !selectedUserId
                              ? "bg-zinc-700 text-zinc-200"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {(allProjects ?? []).length}
                        </span>
                      </Link>
                    </li>
                    {userCounts.map(({ id, count }) => {
                      const owner = ownerMap.get(id);
                      const name =
                        owner?.username ?? owner?.email ?? "Sconosciuto";
                      const isActive = selectedUserId === id;
                      return (
                        <li key={id}>
                          <Link
                            href={
                              isActive
                                ? buildUrl({ status: selectedStatus })
                                : buildUrl({ user: id, status: selectedStatus })
                            }
                            className={`flex min-w-0 items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                              isActive
                                ? "bg-zinc-900 font-medium text-white"
                                : "text-zinc-600 hover:bg-zinc-100"
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {name}
                            </span>
                            <span
                              className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                isActive
                                  ? "bg-zinc-700 text-zinc-200"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {count}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-2">
                  <h3 className="px-1 text-sm font-semibold text-zinc-700">
                    Filtra per stato
                  </h3>
                  <ul className="mt-3 space-y-1">
                    <li>
                      <Link
                        href={buildUrl({ user: selectedUserId })}
                        className={`flex min-w-0 items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                          !selectedStatus
                            ? "bg-zinc-900 font-medium text-white"
                            : "text-zinc-600 hover:bg-zinc-100"
                        }`}
                      >
                        <span>Tutti</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            !selectedStatus
                              ? "bg-zinc-700 text-zinc-200"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {(allProjects ?? []).length}
                        </span>
                      </Link>
                    </li>
                    {statusCounts.map(({ status, count }) => {
                      const isActive = selectedStatus === status;
                      return (
                        <li key={status}>
                          <Link
                            href={
                              isActive
                                ? buildUrl({ user: selectedUserId })
                                : buildUrl({ user: selectedUserId, status })
                            }
                            className={`flex min-w-0 items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                              isActive
                                ? "bg-zinc-900 font-medium text-white"
                                : "text-zinc-600 hover:bg-zinc-100"
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate capitalize">
                              {status}
                            </span>
                            <span
                              className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                isActive
                                  ? "bg-zinc-700 text-zinc-200"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {count}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>
            </details>
          </aside>
        </div>
      </main>
    </div>
  );
}
