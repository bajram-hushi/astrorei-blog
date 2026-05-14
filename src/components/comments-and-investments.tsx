"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { addComment, investInPost, voteComment } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { formatEurCompact } from "@/lib/currency";
import { CommentEditor } from "@/components/comment-editor";

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
          throw new Error("Caricamento dati fallito");
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

  // Scroll to comment if hash is present in URL
  useEffect(() => {
    if (typeof window === "undefined" || comments.length === 0) return;

    const hash = window.location.hash;
    if (hash && hash.startsWith("#comment-")) {
      // Small delay to ensure the DOM is fully rendered
      const timeoutId = setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          // Add a highlight effect
          element.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-blue-500", "ring-offset-2");
          }, 2000);
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [comments]);

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
    const indent = Math.min(depth * 10, 28);

    return (
      <article
        key={comment.id}
        id={`comment-${comment.id}`}
        className="rounded-md border border-zinc-200 bg-white p-2.5 sm:p-3"
        style={{ marginLeft: `${indent}px` }}
      >
        <div className="flex gap-2 sm:gap-2.5">
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <form action={voteComment}>
              <input type="hidden" name="post_id" value={postId} />
              <input type="hidden" name="comment_id" value={comment.id} />
              <input type="hidden" name="vote" value="1" />
              <PendingSubmitButton
                className={`rounded px-1.5 py-0.5 text-[10px] ${userVote === 1 ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
                ariaLabel="Vota positivo"
                pendingText="..."
              >
                ▲
              </PendingSubmitButton>
            </form>
            <span className="text-[10px] font-semibold text-zinc-700">
              {score}
            </span>
            <form action={voteComment}>
              <input type="hidden" name="post_id" value={postId} />
              <input type="hidden" name="comment_id" value={comment.id} />
              <input type="hidden" name="vote" value="-1" />
              <PendingSubmitButton
                className={`rounded px-1.5 py-0.5 text-[10px] ${userVote === -1 ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
                ariaLabel="Vota negativo"
                pendingText="..."
              >
                ▼
              </PendingSubmitButton>
            </form>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600">
              <Link
                href={
                  comment.author_id === userId
                    ? "/profile"
                    : `/user/${comment.author_id}`
                }
                className="flex items-center gap-1 hover:underline"
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt="Avatar autore del commento"
                    className="h-4 w-4 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-300 text-[9px] font-semibold text-zinc-700">
                    {(profile?.username ?? comment.author_email ?? "u")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                )}
                <span>{profile?.username ?? comment.author_email}</span>
              </Link>
              <span className="text-zinc-400">
                · {new Date(comment.created_at).toLocaleString()}
              </span>
            </div>

            <div
              className="prose prose-sm mt-1 max-w-none text-[13px] leading-5"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(comment.body, {
                  allowedTags: [
                    "p",
                    "br",
                    "strong",
                    "em",
                    "u",
                    "a",
                    "ul",
                    "ol",
                    "li",
                    "span",
                  ],
                  allowedAttributes: {
                    a: ["href", "target", "rel"],
                    span: ["class", "data-type", "data-id", "data-label"],
                  },
                }),
              }}
            />

            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-medium text-zinc-600 hover:text-zinc-900">
                Rispondi
              </summary>
              <form action={addComment} className="mt-1.5 space-y-1.5">
                <input type="hidden" name="post_id" value={postId} />
                <input type="hidden" name="parent_id" value={comment.id} />
                <CommentEditor
                  name="body"
                  placeholder="Scrivi una risposta"
                  rows={2}
                  onSubmit={() => {
                    const form = document
                      .querySelector(
                        `form input[name="parent_id"][value="${comment.id}"]`,
                      )
                      ?.closest("form") as HTMLFormElement;
                    if (form) {
                      const submitBtn = form.querySelector(
                        'button[type="submit"]',
                      ) as HTMLButtonElement;
                      submitBtn?.click();
                    }
                  }}
                />
                <PendingSubmitButton
                  className="rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] text-white hover:bg-zinc-700"
                  pendingText="Invio risposta..."
                >
                  Rispondi
                </PendingSubmitButton>
              </form>
            </details>

            {children.length > 0 && (
              <div className="mt-2 space-y-2">
                {children.map((child) => renderComment(child, depth + 1))}
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      <section className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
          Pool investimento team
        </p>
        {loading ? (
          <p className="mt-2 text-sm text-sky-700">
            Caricamento dati investimento...
          </p>
        ) : error ? (
          <p className="mt-2 text-sm text-red-700">
            Errore nel caricamento degli investimenti: {error}
          </p>
        ) : (
          <>
            <p className="mt-1 text-lg font-bold text-sky-950">
              EUR {formatEurCompact(communityInvestmentTotal)}
            </p>
            {myPostInvestment > 0 && (
              <p className="mt-1 text-sm text-sky-900/85">
                Hai investito EUR {formatEurCompact(myPostInvestment)} in questo
                post.
              </p>
            )}
            {canInvestInPost && (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-sky-900/85">
                  Disponibile da investire: EUR{" "}
                  {formatEurCompact(userInvestmentSummary.availableToInvest)}
                </p>
                <form
                  action={investInPost}
                  className="flex flex-col gap-2 sm:flex-row sm:items-end"
                >
                  <input type="hidden" name="post_id" value={postId} />
                  <input
                    type="hidden"
                    name="redirect_to"
                    value={`/post/${postId}`}
                  />
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-sky-800">
                      Importo investimento (EUR)
                    </span>
                    <input
                      type="number"
                      name="amount"
                      min="1"
                      max={Math.max(userInvestmentSummary.availableToInvest, 1)}
                      step="1"
                      defaultValue={
                        Math.min(
                          userInvestmentSummary.availableToInvest,
                          1000,
                        ) || 1
                      }
                      className="w-full rounded-md border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-900 sm:w-40"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={userInvestmentSummary.availableToInvest <= 0}
                  >
                    Investi nel post
                  </button>
                </form>
              </div>
            )}
            {!canInvestInPost && (
              <p className="mt-2 text-sm text-sky-900/85">
                Non puoi investire nel tuo stesso post.
              </p>
            )}
          </>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <h2 className="text-xl font-semibold">Commenti</h2>

        <form
          action={addComment}
          className="mt-3 space-y-2"
          id="main-comment-form"
        >
          <input type="hidden" name="post_id" value={postId} />
          <CommentEditor
            name="body"
            placeholder="Scrivi il tuo commento"
            rows={3}
            onSubmit={() => {
              const form = document.getElementById(
                "main-comment-form",
              ) as HTMLFormElement;
              const submitBtn = form?.querySelector(
                'button[type="submit"]',
              ) as HTMLButtonElement;
              submitBtn?.click();
            }}
          />
          <PendingSubmitButton
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
            pendingText="Aggiunta..."
          >
            Aggiungi commento
          </PendingSubmitButton>
        </form>

        {loading ? (
          <p className="mt-4 text-zinc-600">Caricamento commenti...</p>
        ) : error ? (
          <p className="mt-4 text-red-700">
            Errore nel caricamento dei commenti: {error}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {(childrenMap.get(null) ?? []).map((comment) =>
              renderComment(comment, 0),
            )}
            {!comments.length && (
              <p className="text-zinc-600">Nessun commento ancora.</p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
