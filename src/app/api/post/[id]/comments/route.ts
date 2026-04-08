import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { redirect } from "next/navigation";

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_email: string;
  parent_id: string | null;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

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

  const authorIds = Array.from(new Set(commentRows.map((comment) => comment.author_id)));
  let profileMap = new Map<string, any>();

  if (authorIds.length) {
    const { data: profiles } = await supabase
      .schema("blog")
      .from("profiles")
      .select("id, email, username, avatar_url")
      .in("id", authorIds);

    profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  }

  return Response.json({
    comments: commentRows,
    scoreMap: Object.fromEntries(scoreMap),
    userVoteMap: Object.fromEntries(userVoteMap),
    profileMap: Object.fromEntries(profileMap),
  });
}
