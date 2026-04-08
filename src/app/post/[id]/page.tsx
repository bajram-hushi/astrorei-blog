import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addComment, evaluatePostInvestment, investInPost, voteComment } from "@/app/actions";
import { Header } from "@/components/header";
import { PostContent } from "@/components/post-content";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { BlogProfile } from "@/lib/profile";
import { formatEurCompact } from "@/lib/currency";
import { getUserInvestmentSummary, sumAmounts } from "@/lib/investments";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; detail?: string; eval_status?: string; eval_detail?: string; invest_status?: string; invest_detail?: string }>;
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
    default:
      return null;
  }
}

function investMessage(status?: string, detail?: string) {
  switch (status) {
    case "invested":
      return {
        tone: "success",
        text: detail ? `Investment placed. Remaining balance: EUR ${formatEurCompact(Number(detail))}.` : "Investment placed.",
      } as const;
    case "insufficient_funds":
      return {
        tone: "error",
        text: `Insufficient balance. You can invest up to EUR ${formatEurCompact(Number(detail ?? 0))}.`,
      } as const;
    case "own_post":
      return { tone: "error", text: "You cannot invest in your own post." } as const;
    case "invalid_amount":
      return { tone: "error", text: "Enter a positive investment amount." } as const;
    case "missing_post_id":
      return { tone: "error", text: "Missing post id for investment." } as const;
    case "post_not_found":
      return { tone: "error", text: "Post not found for investment." } as const;
    case "db_update_failed":
      return { tone: "error", text: detail ? `Could not save investment: ${detail}` : "Could not save investment." } as const;
    default:
      return null;
  }
}

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_email: string;
  parent_id: string | null;
};

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

  const postData = post;

  const [communityInvestmentResult, currentUserInvestmentSummary] = await Promise.all([
    supabase.schema("blog").from("post_investments").select("investor_id, amount").eq("post_id", id),
    getUserInvestmentSummary(supabase, user.id),
  ]);

  const communityInvestmentTotal = sumAmounts(communityInvestmentResult.data ?? []);
  const myPostInvestment = (communityInvestmentResult.data ?? []).find((row) => row.investor_id === user.id)?.amount ?? 0;
  const canInvestInPost = postData.author_id !== user.id;

  const { data: comments } = await supabase
    .schema("blog")
    .from("comments")
    .select("id, body, created_at, author_id, author_email, parent_id")
    .eq("post_id", id)
    .order("created_at", { ascending: true });

  const commentRows = (comments ?? []) as CommentRow[];
  const commentIds = commentRows.map((comment) => comment.id);

  const scoreMap = new Map<string, number>();
  const userVoteMap = new Map<string, number>();

  if (commentIds.length) {
    const { data: voteRows } = await supabase
      .schema("blog")
      .from("comment_votes")
      .select("comment_id, user_id, vote")
      .in("comment_id", commentIds);

    for (const vote of voteRows ?? []) {
      scoreMap.set(vote.comment_id, (scoreMap.get(vote.comment_id) ?? 0) + vote.vote);
      if (vote.user_id === user?.id) {
        userVoteMap.set(vote.comment_id, vote.vote);
      }
    }
  }

  const authorIds = Array.from(
    new Set([postData.author_id, ...commentRows.map((comment) => comment.author_id)]),
  );
  let profileMap = new Map<string, BlogProfile>();

  if (authorIds.length) {
    const { data: profiles } = await supabase
      .schema("blog")
      .from("profiles")
      .select("id, email, username, avatar_url")
      .in("id", authorIds);

    profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile as BlogProfile]));
  }

  const childrenMap = new Map<string | null, CommentRow[]>();
  for (const comment of commentRows) {
    const key = comment.parent_id;
    const existing = childrenMap.get(key) ?? [];
    existing.push(comment);
    childrenMap.set(key, existing);
  }

  function renderComment(comment: CommentRow, depth: number) {
    const profile = profileMap.get(comment.author_id);
    const children = childrenMap.get(comment.id) ?? [];
    const score = scoreMap.get(comment.id) ?? 0;
    const userVote = userVoteMap.get(comment.id) ?? 0;

    return (
      <article
        key={comment.id}
        className="rounded-md border border-zinc-200 bg-white p-2.5"
        style={{ marginLeft: `${Math.min(depth * 14, 72)}px` }}
      >
        <div className="flex gap-2.5">
          <div className="flex flex-col items-center gap-0.5">
            <form action={voteComment}>
              <input type="hidden" name="post_id" value={postData.id} />
              <input type="hidden" name="comment_id" value={comment.id} />
              <input type="hidden" name="vote" value="1" />
              <PendingSubmitButton
                className={`rounded px-1.5 py-0.5 text-[10px] ${userVote === 1 ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
                ariaLabel="Upvote comment"
                pendingText="..."
              >
                ▲
              </PendingSubmitButton>
            </form>
            <span className="text-[10px] font-semibold text-zinc-700">{score}</span>
            <form action={voteComment}>
              <input type="hidden" name="post_id" value={postData.id} />
              <input type="hidden" name="comment_id" value={comment.id} />
              <input type="hidden" name="vote" value="-1" />
              <PendingSubmitButton
                className={`rounded px-1.5 py-0.5 text-[10px] ${userVote === -1 ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
                ariaLabel="Downvote comment"
                pendingText="..."
              >
                ▼
              </PendingSubmitButton>
            </form>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
              <Link
                href={comment.author_id === user?.id ? "/profile" : `/user/${comment.author_id}`}
                className="flex items-center gap-1 hover:underline"
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt="Comment author avatar"
                    className="h-4 w-4 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-300 text-[9px] font-semibold text-zinc-700">
                    {(profile?.username ?? comment.author_email ?? "u").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span>{profile?.username ?? comment.author_email}</span>
              </Link>
              <span className="text-zinc-400">· {new Date(comment.created_at).toLocaleString()}</span>
            </div>

            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5">{comment.body}</p>

            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-medium text-zinc-600 hover:text-zinc-900">
                Reply
              </summary>
              <form action={addComment} className="mt-1.5 space-y-1.5">
                <input type="hidden" name="post_id" value={postData.id} />
                <input type="hidden" name="parent_id" value={comment.id} />
                <textarea
                  name="body"
                  required
                  rows={2}
                  className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
                  placeholder="Write a reply"
                />
                <PendingSubmitButton
                  className="rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] text-white hover:bg-zinc-700"
                  pendingText="Replying..."
                >
                  Reply
                </PendingSubmitButton>
              </form>
            </details>

            {children.length > 0 && <div className="mt-2 space-y-2">{children.map((child) => renderComment(child, depth + 1))}</div>}
          </div>
        </div>
      </article>
    );
  }

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
          <h1 className="text-3xl font-bold tracking-tight">{postData.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
            <Link
              href={postData.author_id === user?.id ? "/profile" : `/user/${postData.author_id}`}
              className="flex items-center gap-1.5 hover:underline"
            >
              {profileMap.get(postData.author_id)?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileMap.get(postData.author_id)?.avatar_url ?? ""}
                  alt="Author avatar"
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-300 text-xs font-semibold text-zinc-700">
                  {(profileMap.get(postData.author_id)?.username ?? postData.author_email ?? "u")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
              )}
              <span>{profileMap.get(postData.author_id)?.username ?? postData.author_email}</span>
            </Link>
            <span className="text-zinc-400">{new Date(postData.created_at).toLocaleString()}</span>
          </div>
          <div className="mt-6">
            <PostContent
              content={postData.content}
              format={postData.content_format as "markdown" | "richtext"}
            />
          </div>
          {postData.investment_eur !== null && postData.investment_eur !== undefined && (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Angel Investor Decision</p>
              <p className="mt-1 text-lg font-bold text-emerald-900">
                EUR {formatEurCompact(postData.investment_eur)}
                {postData.investment_confidence ? ` (${postData.investment_confidence}% confidence)` : ""}
              </p>
              {postData.investment_thesis && (
                <p className="mt-1 text-sm text-emerald-900/85">{postData.investment_thesis}</p>
              )}
            </div>
          )}
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Team Investment Pool</p>
            <p className="mt-1 text-lg font-bold text-sky-950">EUR {formatEurCompact(communityInvestmentTotal)}</p>
            {myPostInvestment > 0 && (
              <p className="mt-1 text-sm text-sky-900/85">You have invested EUR {formatEurCompact(myPostInvestment)} in this post.</p>
            )}
            {canInvestInPost && (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-sky-900/85">
                  Available to invest: EUR {formatEurCompact(currentUserInvestmentSummary.availableToInvest)}
                </p>
                <form action={investInPost} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="post_id" value={postData.id} />
                  <input type="hidden" name="redirect_to" value={`/post/${postData.id}`} />
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-sky-800">Invest amount (EUR)</span>
                    <input
                      type="number"
                      name="amount"
                      min="1"
                      max={Math.max(currentUserInvestmentSummary.availableToInvest, 1)}
                      step="1"
                      defaultValue={Math.min(currentUserInvestmentSummary.availableToInvest, 1000) || 1}
                      className="w-full rounded-md border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-900 sm:w-40"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={currentUserInvestmentSummary.availableToInvest <= 0}
                  >
                    Invest in Post
                  </button>
                </form>
              </div>
            )}
            {!canInvestInPost && (
              <p className="mt-2 text-sm text-sky-900/85">You cannot invest in your own post.</p>
            )}
          </div>
          {(postData.investment_eur === null || postData.investment_eur === undefined) && (
            <form action={evaluatePostInvestment} className="mt-6">
              <input type="hidden" name="post_id" value={postData.id} />
              <input type="hidden" name="redirect_to" value={`/post/${postData.id}`} />
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Evaluate with Angel Investor
              </button>
            </form>
          )}
        </article>

        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Comments</h2>

          {query.error && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Error: {query.error}
              {query.detail ? ` - ${query.detail}` : ""}
            </p>
          )}

          <form action={addComment} className="mt-3 space-y-2">
            <input type="hidden" name="post_id" value={postData.id} />
            <textarea
              name="body"
              required
              rows={3}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Write your comment"
            />
            <PendingSubmitButton
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
              pendingText="Adding..."
            >
              Add Comment
            </PendingSubmitButton>
          </form>

          <div className="mt-4 space-y-2">
            {(childrenMap.get(null) ?? []).map((comment) => renderComment(comment, 0))}

            {!commentRows.length && <p className="text-zinc-600">No comments yet.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
