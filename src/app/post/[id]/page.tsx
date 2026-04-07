import { notFound, redirect } from "next/navigation";
import { addComment, voteComment } from "@/app/actions";
import { Header } from "@/components/header";
import { PostContent } from "@/components/post-content";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { BlogProfile } from "@/lib/profile";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; detail?: string }>;
};

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedUser(user)) {
    redirect("/login");
  }

  const { data: post } = await supabase
    .schema("blog")
    .from("posts")
    .select("id, title, content, content_format, created_at, author_id, author_email")
    .eq("id", id)
    .single();

  if (!post) {
    notFound();
  }

  const postData = post;

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
              <button
                type="submit"
                className={`rounded px-1.5 py-0.5 text-[10px] ${userVote === 1 ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
                aria-label="Upvote comment"
              >
                ▲
              </button>
            </form>
            <span className="text-[10px] font-semibold text-zinc-700">{score}</span>
            <form action={voteComment}>
              <input type="hidden" name="post_id" value={postData.id} />
              <input type="hidden" name="comment_id" value={comment.id} />
              <input type="hidden" name="vote" value="-1" />
              <button
                type="submit"
                className={`rounded px-1.5 py-0.5 text-[10px] ${userVote === -1 ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
                aria-label="Downvote comment"
              >
                ▼
              </button>
            </form>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
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
              <span>
                {profile?.username ?? comment.author_email} - {new Date(comment.created_at).toLocaleString()}
              </span>
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
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] text-white hover:bg-zinc-700"
                >
                  Reply
                </button>
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
        <article className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-3xl font-bold tracking-tight">{postData.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
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
            <span>
              {new Date(postData.created_at).toLocaleString()} - {profileMap.get(postData.author_id)?.username ?? postData.author_email}
            </span>
          </div>
          <div className="mt-6">
            <PostContent
              content={postData.content}
              format={postData.content_format as "markdown" | "richtext"}
            />
          </div>
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
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
            >
              Add Comment
            </button>
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
