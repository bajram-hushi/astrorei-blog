import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type UserInvestmentSummary = {
  totalAngelReceived: number;
  totalCommunityReceived: number;
  totalReceived: number;
  totalSpent: number;
  availableToInvest: number;
};

export function sumAmounts(rows: Array<{ amount?: number | null; investment_eur?: number | null }>) {
  return rows.reduce((sum, row) => sum + (row.amount ?? row.investment_eur ?? 0), 0);
}

export async function getUserInvestmentSummary(supabase: SupabaseClient, userId: string): Promise<UserInvestmentSummary> {
  const { data: authoredPosts } = await supabase
    .schema("blog")
    .from("posts")
    .select("id, investment_eur")
    .eq("author_id", userId);

  const totalAngelReceived = sumAmounts(authoredPosts ?? []);
  const authoredPostIds = (authoredPosts ?? []).map((post) => post.id);

  let totalCommunityReceived = 0;
  if (authoredPostIds.length) {
    const { data: receivedInvestments } = await supabase
      .schema("blog")
      .from("post_investments")
      .select("amount")
      .in("post_id", authoredPostIds);
    totalCommunityReceived = sumAmounts(receivedInvestments ?? []);
  }

  const { data: spentInvestments } = await supabase
    .schema("blog")
    .from("post_investments")
    .select("amount")
    .eq("investor_id", userId);

  const totalSpent = sumAmounts(spentInvestments ?? []);
  const totalReceived = totalAngelReceived + totalCommunityReceived;

  return {
    totalAngelReceived,
    totalCommunityReceived,
    totalReceived,
    totalSpent,
    availableToInvest: Math.max(totalReceived - totalSpent, 0),
  };
}