import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { generateEasterEggMessage } from "@/lib/easter-egg-agent";
import { sendPushToAllUsers } from "@/lib/push";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const message = await generateEasterEggMessage();

  const result = await sendPushToAllUsers({
    title: "ReiLabs Easter Egg",
    body: message,
    url: "/notifications",
    tag: `easter-egg-${crypto.randomUUID()}`,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === "no_subscriptions" ? 400 : 500 },
    );
  }

  return NextResponse.json({ ok: true, message });
}