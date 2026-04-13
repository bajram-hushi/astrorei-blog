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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Progetti</h1>
            <p className="text-sm text-zinc-600">Tieni traccia delle idee dal concept al lancio e collega i post ai progetti.</p>
          </div>
          <Link href="/projects/new" className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700">
            Nuovo progetto
          </Link>
        </div>

        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1">
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((project) => {
                const owner = ownerMap.get(project.owner_user_id);
                return (
                  <article key={project.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
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
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/projects/${project.id}`} className="text-lg font-semibold hover:underline">
                          {project.title}
                        </Link>
                        <span className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700">
                          {project.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-700">{summaryPreview(project.summary)}</p>
                      <p className="mt-3 text-xs text-zinc-500">
                        Proprietario: {owner?.username ?? owner?.email ?? "Sconosciuto"} · {new Date(project.created_at).toLocaleDateString()}
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

          <aside className="w-52 shrink-0 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">Filtra per utente</h2>
            <ul className="space-y-1">
              <li>
                <Link
                  href={buildUrl({ status: selectedStatus })}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                    !selectedUserId ? "bg-zinc-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  <span>Tutti</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    !selectedUserId ? "bg-zinc-700 text-zinc-200" : "bg-zinc-100 text-zinc-600"
                  }`}>
                    {(allProjects ?? []).length}
                  </span>
                </Link>
              </li>
              {userCounts.map(({ id, count }) => {
                const owner = ownerMap.get(id);
                const name = owner?.username ?? owner?.email ?? "Sconosciuto";
                const isActive = selectedUserId === id;
                return (
                  <li key={id}>
                    <Link
                      href={isActive ? buildUrl({ status: selectedStatus }) : buildUrl({ user: id, status: selectedStatus })}
                      className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                        isActive ? "bg-zinc-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      <span className="truncate">{name}</span>
                      <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        isActive ? "bg-zinc-700 text-zinc-200" : "bg-zinc-100 text-zinc-600"
                      }`}>
                        {count}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="my-4 border-t border-zinc-100" />
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">Filtra per stato</h2>
            <ul className="space-y-1">
              <li>
                <Link
                  href={buildUrl({ user: selectedUserId })}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                    !selectedStatus ? "bg-zinc-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  <span>Tutti</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    !selectedStatus ? "bg-zinc-700 text-zinc-200" : "bg-zinc-100 text-zinc-600"
                  }`}>
                    {(allProjects ?? []).length}
                  </span>
                </Link>
              </li>
              {statusCounts.map(({ status, count }) => {
                const isActive = selectedStatus === status;
                return (
                  <li key={status}>
                    <Link
                      href={isActive ? buildUrl({ user: selectedUserId }) : buildUrl({ user: selectedUserId, status })}
                      className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                        isActive ? "bg-zinc-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      <span className="truncate capitalize">{status}</span>
                      <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        isActive ? "bg-zinc-700 text-zinc-200" : "bg-zinc-100 text-zinc-600"
                      }`}>
                        {count}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
