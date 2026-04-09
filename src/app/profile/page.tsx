import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { updateProfile } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { formatEurCompact } from "@/lib/currency";
import { getUserInvestmentSummary } from "@/lib/investments";
import { getDefaultUsername, resolveProfile } from "@/lib/profile";
import { ProfileAvatarField } from "@/components/profile-avatar-field";

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

function errorText(error?: string) {
  if (!error) return "";
  if (error === "invalid_username") return "Il nome utente deve essere tra 2 e 50 caratteri.";
  return `Impossibile aggiornare il profilo: ${error}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}g fa`;
  return new Date(dateStr).toLocaleDateString("it-IT", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ProfilePage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    redirect("/login");
  }

  const [{ data: profile }, { data: myPosts }, { data: myComments }] = await Promise.all([
    supabase.schema("blog").from("profiles").select("id, email, username, avatar_url, created_at").eq("id", user.id).maybeSingle(),
    supabase.schema("blog").from("posts").select("id, title, created_at, investment_eur").eq("author_id", user.id).order("created_at", { ascending: false }),
    supabase.schema("blog").from("comments").select("id, body, post_id, created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);

  const investmentSummary = await getUserInvestmentSummary(supabase, user.id);

  const resolved = resolveProfile(user, profile);

  // Fetch post titles for the user's comments
  const commentPostIds = Array.from(new Set((myComments ?? []).map((c) => c.post_id)));
  let postTitleMap = new Map<string, string>();
  if (commentPostIds.length) {
    const { data: commentPosts } = await supabase
      .schema("blog").from("posts").select("id, title").in("id", commentPostIds);
    postTitleMap = new Map((commentPosts ?? []).map((p) => [p.id, p.title]));
  }

  // Tally votes received on the user's own comments
  const myCommentIds = (myComments ?? []).map((c) => c.id);
  let totalVotesReceived = 0;
  const commentScoreMap = new Map<string, number>();
  if (myCommentIds.length) {
    const { data: votes } = await supabase
      .schema("blog").from("comment_votes").select("comment_id, vote").in("comment_id", myCommentIds);
    for (const v of votes ?? []) {
      commentScoreMap.set(v.comment_id, (commentScoreMap.get(v.comment_id) ?? 0) + v.vote);
    }
    totalVotesReceived = Array.from(commentScoreMap.values()).reduce((sum, s) => sum + s, 0);
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("it-IT", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-8">

        {/* ── Profile header ── */}
        <div className="flex items-center gap-5 rounded-xl border border-zinc-200 bg-white p-6">
          {resolved.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolved.avatarUrl} alt="Avatar profilo" className="h-16 w-16 rounded-full object-cover ring-2 ring-zinc-100" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xl font-bold text-zinc-600">
              {resolved.username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold truncate">{resolved.username}</p>
            <p className="text-sm text-zinc-500 truncate">{user.email}</p>
            {memberSince && <p className="text-xs text-zinc-400 mt-0.5">Membro dal {memberSince}</p>}
          </div>
        </div>

        {/* ── Activity stats ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Post", value: myPosts?.length ?? 0 },
            { label: "Commenti", value: myComments?.length ?? 0 },
            { label: "Voti ricevuti", value: totalVotesReceived },
            { label: "Angel investito", value: `EUR ${formatEurCompact(investmentSummary.totalAngelReceived)}` },
            { label: "Disponibile da investire", value: `EUR ${formatEurCompact(investmentSummary.availableToInvest)}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Posts ── */}
        <section>
          <h2 className="mb-3 text-base font-semibold">I tuoi post</h2>
          {!myPosts?.length ? (
            <p className="text-sm text-zinc-500">Nessun post ancora. <Link href="/new" className="underline">Scrivi il tuo primo post.</Link></p>
          ) : (
            <ul className="space-y-2">
              {myPosts.map((post) => (
                <li key={post.id} className="flex items-baseline justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 gap-3">
                  <Link href={`/post/${post.id}`} className="font-medium hover:underline truncate">
                    {post.title}
                  </Link>
                  <span className="shrink-0 text-xs text-zinc-400">{timeAgo(post.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Comments ── */}
        <section>
          <h2 className="mb-3 text-base font-semibold">I tuoi commenti</h2>
          {!myComments?.length ? (
            <p className="text-sm text-zinc-500">Nessun commento ancora.</p>
          ) : (
            <ul className="space-y-2">
              {myComments.map((comment) => {
                const postTitle = postTitleMap.get(comment.post_id) ?? "Post senza titolo";
                const snippet = comment.body.replace(/<[^>]+>/g, "").slice(0, 120);
                const score = commentScoreMap.get(comment.id) ?? 0;
                return (
                  <li key={comment.id} className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/post/${comment.post_id}`} className="text-xs font-medium text-zinc-500 hover:underline">
                        su: {postTitle}
                      </Link>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          score > 0
                            ? "bg-emerald-50 text-emerald-700"
                            : score < 0
                            ? "bg-red-50 text-red-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {score > 0 ? `+${score}` : score}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-700 line-clamp-2">
                      {snippet}{comment.body.length > 120 ? "…" : ""}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">{timeAgo(comment.created_at)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Edit profile ── */}
        <section>
          <details className="group rounded-xl border border-zinc-200 bg-white">
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold select-none">
              Modifica profilo
              <svg className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-zinc-100 px-5 py-4">
              <p className="mb-4 text-sm text-zinc-500">Personalizza come appare la tua identità nei post e nei commenti.</p>

              {params.error && (
                <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errorText(params.error)}
                </p>
              )}
              {params.success && (
                <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  Profilo aggiornato.
                </p>
              )}

              <form action={updateProfile} className="space-y-4">
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Nome utente</span>
                  <input
                    name="username"
                    required
                    defaultValue={profile?.username ?? getDefaultUsername(user)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>

                <ProfileAvatarField defaultValue={profile?.avatar_url ?? ""} />

                <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700">
                  Salva profilo
                </button>
              </form>
            </div>
          </details>
        </section>

      </main>
    </div>
  );
}
