import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { getDefaultUsername } from "@/lib/profile";
import { getUserInvestmentSummary } from "@/lib/investments";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!isAllowedUser(currentUser)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [{ data: profile }, { data: posts }, { data: comments }] =
      await Promise.all([
        supabase
          .schema("blog")
          .from("profiles")
          .select("id, email, username, avatar_url, created_at")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .schema("blog")
          .from("posts")
          .select("id, investment_eur")
          .eq("author_id", id),
        supabase.schema("blog").from("comments").select("id").eq("author_id", id),
      ]);

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get total votes received on comments
    const commentIds = (comments ?? []).map((c) => c.id);
    let totalVotesReceived = 0;
    if (commentIds.length > 0) {
      const { data: votes } = await supabase
        .schema("blog")
        .from("comment_votes")
        .select("vote")
        .in("comment_id", commentIds);
      totalVotesReceived = (votes ?? []).reduce((sum, v) => sum + v.vote, 0);
    }

    const investmentSummary = await getUserInvestmentSummary(supabase, id);

    const username =
      profile.username?.trim() ||
      getDefaultUsername({ id, email: profile.email ?? "" } as never);

    return NextResponse.json({
      id: profile.id,
      username,
      avatarUrl: profile.avatar_url?.trim() ?? null,
      memberSince: profile.created_at,
      stats: {
        postsCount: posts?.length ?? 0,
        commentsCount: comments?.length ?? 0,
        totalVotesReceived,
        totalInvestmentReceived:
          investmentSummary.totalAngelReceived +
          investmentSummary.totalCommunityReceived,
      },
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch user stats" },
      { status: 500 }
    );
  }
}
