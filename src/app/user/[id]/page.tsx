import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser, } from "@/lib/auth";
import { formatEurCompact } from "@/lib/currency";
import { getDefaultUsername } from "@/lib/profile";

type Props = {
  params: Promise<{ id: string }>;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!isAllowedUser(currentUser)) {
    redirect("/login");
  }

  // If viewing own profile, redirect to the full edit-capable profile page
  if (currentUser?.id === id) {
    redirect("/profile");
  }

  const [{ data: profile }, { data: posts }, { data: comments }] = await Promise.all([
    supabase.schema("blog").from("profiles").select("id, email, username, avatar_url, created_at").eq("id", id).maybeSingle(),
    supabase.schema("blog").from("posts").select("id, title, created_at, investment_eur").eq("author_id", id).order("created_at", { ascending: false }),
    supabase.schema("blog").from("comments").select("id, body, post_id, created_at").eq("author_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  // Need at least a profile or some activity to show the page
  if (!profile && !posts?.length && !comments?.length) {
    notFound();
  }

  const username = profile?.username?.trim() || getDefaultUsername({ id, email: profile?.email ?? "" } as never);
  const avatarUrl = profile?.avatar_url?.trim() ?? null;

  // Fetch post titles for the comments
  const commentPostIds = Array.from(new Set((comments ?? []).map((c) => c.post_id)));
  let postTitleMap = new Map<string, string>();
  if (commentPostIds.length) {
    const { data: commentPosts } = await supabase
      .schema("blog").from("posts").select("id, title").in("id", commentPostIds);
    postTitleMap = new Map((commentPosts ?? []).map((p) => [p.id, p.title]));
  }

  // Fetch vote scores per comment
  const commentIds = (comments ?? []).map((c) => c.id);
  const commentScoreMap = new Map<string, number>();
  let totalVotesReceived = 0;
  if (commentIds.length) {
    const { data: votes } = await supabase
      .schema("blog").from("comment_votes").select("comment_id, vote").in("comment_id", commentIds);
    for (const v of votes ?? []) {
      commentScoreMap.set(v.comment_id, (commentScoreMap.get(v.comment_id) ?? 0) + v.vote);
    }
    totalVotesReceived = Array.from(commentScoreMap.values()).reduce((sum, s) => sum + s, 0);
  }

  const totalAngelInvestment = (posts ?? []).reduce((sum, post) => sum + (post.investment_eur ?? 0), 0);

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-8">

        {/* ── Profile header ── */}
        <div className="flex items-center gap-5 rounded-xl border border-zinc-200 bg-white p-6">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={`${username}'s avatar`} className="h-16 w-16 rounded-full object-cover ring-2 ring-zinc-100" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xl font-bold text-zinc-600">
              {username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold truncate">{username}</p>
            {memberSince && <p className="text-xs text-zinc-400 mt-0.5">Member since {memberSince}</p>}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Posts", value: posts?.length ?? 0 },
            { label: "Comments", value: comments?.length ?? 0 },
            { label: "Votes received", value: totalVotesReceived },
            { label: "Angel invested", value: `EUR ${formatEurCompact(totalAngelInvestment)}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Posts ── */}
        <section>
          <h2 className="mb-3 text-base font-semibold">Posts by {username}</h2>
          {!posts?.length ? (
            <p className="text-sm text-zinc-500">No posts yet.</p>
          ) : (
            <ul className="space-y-2">
              {posts.map((post) => (
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
          <h2 className="mb-3 text-base font-semibold">Comments by {username}</h2>
          {!comments?.length ? (
            <p className="text-sm text-zinc-500">No comments yet.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((comment) => {
                const postTitle = postTitleMap.get(comment.post_id) ?? "Untitled post";
                const snippet = comment.body.replace(/<[^>]+>/g, "").slice(0, 120);
                const score = commentScoreMap.get(comment.id) ?? 0;
                return (
                  <li key={comment.id} className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/post/${comment.post_id}`} className="text-xs font-medium text-zinc-500 hover:underline">
                        on: {postTitle}
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

      </main>
    </div>
  );
}
