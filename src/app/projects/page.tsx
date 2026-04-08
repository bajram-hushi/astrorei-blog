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

export default async function ProjectsPage() {
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
    .select("id, title, summary, image_url, status, owner_user_id, created_at")
    .order("created_at", { ascending: false });

  const ownerIds = Array.from(new Set((projects ?? []).map((project) => project.owner_user_id)));
  const { data: owners } = ownerIds.length
    ? await supabase
        .schema("blog")
        .from("profiles")
        .select("id, username, email")
        .in("id", ownerIds)
    : { data: [] as Array<{ id: string; username: string | null; email: string }> };

  const ownerMap = new Map((owners ?? []).map((owner) => [owner.id, owner]));

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-sm text-zinc-600">Track ideas from concept to launch and connect posts to projects.</p>
          </div>
          <Link href="/projects/new" className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700">
            New Project
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => {
            const owner = ownerMap.get(project.owner_user_id);
            return (
              <article key={project.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <Link href={`/projects/${project.id}`} className="block">
                  {project.image_url ? (
                    <div className="aspect-video w-full bg-zinc-100 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={project.image_url}
                        alt={`${project.title} cover`}
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
                    Owner: {owner?.username ?? owner?.email ?? "Unknown"} · {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
              </article>
            );
          })}

          {!projects?.length && (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-600">
              No projects yet. Create your first project concept.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
