import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { evaluatePostInvestment } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { BlogProfile } from "@/lib/profile";
import { formatEurCompact } from "@/lib/currency";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

type Props = {
  searchParams: Promise<{ eval_status?: string; eval_detail?: string }>;
};

function evalMessage(status?: string, detail?: string) {
  switch (status) {
    case "evaluated":
      return { tone: "success", text: "Angel investor evaluation completed." } as const;
    case "already_evaluated":
      return { tone: "info", text: "This post was already evaluated." } as const;
    case "missing_openai_key":
      return { tone: "error", text: "OPENAI_API_KEY is missing. Add it to your environment and retry." } as const;
    case "evaluation_failed":
      return { tone: "error", text: "OpenAI evaluation failed. Check model/key and try again." } as const;
    case "db_update_failed":
      return { tone: "error", text: detail ? `Could not save evaluation: ${detail}` : "Could not save evaluation." } as const;
    case "post_not_found":
      return { tone: "error", text: "Post not found for evaluation." } as const;
    case "missing_post_id":
      return { tone: "error", text: "Missing post id for evaluation." } as const;
    default:
      return null;
  }
}

export default async function Home({ searchParams }: Props) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedUser(user)) {
    redirect("/login");
  }

  const { data: posts } = await supabase
    .schema("blog")
    .from("posts")
    .select("id, title, created_at, author_id, author_email, investment_eur, investment_confidence")
    .order("created_at", { ascending: false });

  const authorIds = Array.from(new Set((posts ?? []).map((post) => post.author_id)));
  let profileMap = new Map<string, BlogProfile>();

  if (authorIds.length) {
    const { data: profiles } = await supabase
      .schema("blog")
      .from("profiles")
      .select("id, email, username, avatar_url")
      .in("id", authorIds);

    profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile as BlogProfile]));
  }

  const evalState = evalMessage(query.eval_status, query.eval_detail);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
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
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Recent Posts</h1>
          <Link
            href="/new"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700"
          >
            Create Post
          </Link>
        </div>

        <div className="space-y-4">
          {posts?.map((post) => (
            <article
              key={post.id}
              className="rounded-lg border border-zinc-200 bg-white p-4"
            >
              <Link
                href={`/post/${post.id}`}
                className="text-lg font-semibold hover:underline"
              >
                {post.title}
              </Link>
              {post.investment_eur !== null &&
                post.investment_eur !== undefined && (
                  <p className="mt-1 text-xs font-medium text-zinc-700">
                    Angel investor: EUR {formatEurCompact(post.investment_eur)}
                    {post.investment_confidence
                      ? ` (confidence ${post.investment_confidence}%)`
                      : ""}
                  </p>
                )}
              {(post.investment_eur === null ||
                post.investment_eur === undefined) && (
                <form action={evaluatePostInvestment} className="mt-2">
                  <input type="hidden" name="post_id" value={post.id} />
                  <input type="hidden" name="redirect_to" value="/" />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Evaluate with Angel Investor
                  </button>
                </form>
              )}
              <div className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
                <Link
                  href={
                    post.author_id === user?.id
                      ? "/profile"
                      : `/user/${post.author_id}`
                  }
                  className="flex items-center gap-1.5 hover:underline"
                >
                  {profileMap.get(post.author_id)?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profileMap.get(post.author_id)?.avatar_url ?? ""}
                      alt="Author avatar"
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-300 text-[10px] font-semibold text-zinc-700">
                      {(
                        profileMap.get(post.author_id)?.username ??
                        post.author_email ??
                        "u"
                      )
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                  )}
                  <span>
                    {profileMap.get(post.author_id)?.username ??
                      post.author_email}
                  </span>
                </Link>
                <span className="text-zinc-400">
                  {new Date(post.created_at).toLocaleString()}
                </span>
              </div>
            </article>
          ))}

          {!posts?.length && (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-600">
              No posts yet. Create your first internal post.
            </p>
          )}
        </div>
      </main>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
