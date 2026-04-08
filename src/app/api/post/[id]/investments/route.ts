import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { getUserInvestmentSummary, sumAmounts } from "@/lib/investments";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const communityInvestmentResult = await supabase
    .schema("blog")
    .from("post_investments")
    .select("investor_id, amount")
    .eq("post_id", id);

  const currentUserInvestmentSummary = await getUserInvestmentSummary(supabase, user.id);

  const communityInvestmentTotal = sumAmounts(communityInvestmentResult.data ?? []);
  const myPostInvestment = (communityInvestmentResult.data ?? []).find((row) => row.investor_id === user.id)?.amount ?? 0;

  const { data: post } = await supabase
    .schema("blog")
    .from("posts")
    .select("author_id")
    .eq("id", id)
    .single();

  const canInvestInPost = post?.author_id !== user.id;

  return Response.json({
    communityInvestmentTotal,
    myPostInvestment,
    canInvestInPost,
    userInvestmentSummary: currentUserInvestmentSummary,
  });
}
