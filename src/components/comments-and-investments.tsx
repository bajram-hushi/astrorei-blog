"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addComment, investInPost, voteComment } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { formatEurCompact } from "@/lib/currency";

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_email: string;
  parent_id: string | null;
};

type BlogProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

interface CommentsAndInvestmentsProps {
  postId: string;
  postAuthorId: string;
  userId: string;
}

export function CommentsAndInvestments({
  postId,
  postAuthorId,
  userId,
}: CommentsAndInvestmentsProps) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [scoreMap, setScoreMap] = useState<Record<string, number>>({});
  const [userVoteMap, setUserVoteMap] = useState<Record<string, number>>({});
  const [profileMap, setProfileMap] = useState<Record<string, BlogProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [communityInvestmentTotal, setCommunityInvestmentTotal] = useState(0);
  const [myPostInvestment, setMyPostInvestment] = useState(0);
  const [canInvestInPost, setCanInvestInPost] = useState(false);
  const [userInvestmentSummary, setUserInvestmentSummary] = useState({
    totalAngelReceived: 0,
    totalCommunityReceived: 0,
    totalReceived: 0,
    totalSpent: 0,
    availableToInvest: 0,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [commentsRes, investmentsRes] = await Promise.all([
          fetch(`/api/post/${postId}/comments`),
          fetch(`/api/post/${postId}/investments`),
        ]);

        if (!commentsRes.ok || !investmentsRes.ok) {
          throw new Error("Failed to load data");
        }

        const commentsData = await commentsRes.json();
        const investmentsData = await investmentsRes.json();

        setComments(commentsData.comments || []);
        setScoreMap(commentsData.scoreMap || {});
        setUserVoteMap(commentsData.userVoteMap || {});
        setProfileMap(commentsData.profileMap || {});

        setCommunityInvestmentTotal(investmentsData.communityInvestmentTotal);
        setMyPostInvestment(investmentsData.myPostInvestment);
        setCanInvestInPost(investmentsData.canInvestInPost);
        setUserInvestmentSummary(investmentsData.userInvestmentSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [postId]);

  const childrenMap = new Map<string | null, CommentRow[]>();
  for (const comment of comments) {
    const key = comment.parent_id;
    const existing = childrenMap.get(key) ?? [];
    existing.push(comment);
    childrenMap.set(key, existing);
  }

  function renderComment(comment: CommentRow, depth: number) {
    const profile = profileMap[comment.author_id];
    const children = childrenMap.get(comment.id) ?? [];
    const score = scoreMap[comment.id] ?? 0;
    const userVote = userVoteMap[comment.id] ?? 0;

    return (
      <article
        key={comment.id}
        className="rounded-md border border-zinc-200 bg-white p-2.5"
        style={{ marginLeft: `${Math.min(depth * 14, 72)}px` }}
      >
        <div className="flex gap-2.5">
          <div className="flex flex-col items-center gap-0.5">
            <form action={voteComment}>
              <input type="hidden" name="post_id" value={postId} />
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
              <input type="hidden" name="post_id" value={postId} />
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
                href={comment.author_id === userId ? "/profile" : `/user/${comment.author_id}`}
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
                <input type="hidden" name="post_id" value={postId} />
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

            {children.length > 0 && (
              <div className="mt-2 space-y-2">{children.map((child) => renderComment(child, depth + 1))}</div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      <section className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Team Investment Pool</p>
        {loading ? (
          <p className="mt-2 text-sm text-sky-700">Loading investment data...</p>
        ) : error ? (
          <p className="mt-2 text-sm text-red-700">Error loading investments: {error}</p>
        ) : (
          <>
            <p className="mt-1 text-lg font-bold text-sky-950">EUR {formatEurCompact(communityInvestmentTotal)}</p>
            {myPostInvestment > 0 && (
              <p className="mt-1 text-sm text-sky-900/85">
                You have invested EUR {formatEurCompact(myPostInvestment)} in this post.
              </p>
            )}
            {canInvestInPost && (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-sky-900/85">
                  Available to invest: EUR {formatEurCompact(userInvestmentSummary.availableToInvest)}
                </p>
                <form action={investInPost} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="post_id" value={postId} />
                  <input type="hidden" name="redirect_to" value={`/post/${postId}`} />
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-sky-800">Invest amount (EUR)</span>
                    <input
                      type="number"
                      name="amount"
                      min="1"
                      max={Math.max(userInvestmentSummary.availableToInvest, 1)}
                      step="1"
                      defaultValue={Math.min(userInvestmentSummary.availableToInvest, 1000) || 1}
                      className="w-full rounded-md border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-900 sm:w-40"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={userInvestmentSummary.availableToInvest <= 0}
                  >
                    Invest in Post
                  </button>
                </form>
              </div>
            )}
            {!canInvestInPost && (
              <p className="mt-2 text-sm text-sky-900/85">You cannot invest in your own post.</p>
            )}
          </>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Comments</h2>

        <form action={addComment} className="mt-3 space-y-2">
          <input type="hidden" name="post_id" value={postId} />
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

        {loading ? (
          <p className="mt-4 text-zinc-600">Loading comments...</p>
        ) : error ? (
          <p className="mt-4 text-red-700">Error loading comments: {error}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {(childrenMap.get(null) ?? []).map((comment) => renderComment(comment, 0))}
            {!comments.length && <p className="text-zinc-600">No comments yet.</p>}
          </div>
        )}
      </section>
    </>
  );
}
