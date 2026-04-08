import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { generateEasterEggMessage } from "@/lib/easter-egg-agent";
import { sendPushToSubscription, sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    subscription?: {
      endpoint?: string;
      keys?: {
        p256dh?: string;
        auth?: string;
      };
    };
  };

  const message = await generateEasterEggMessage();

  const result = await sendPushToUser({
    userId: user.id,
    title: "ReiLabs Easter Egg",
    body: message,
    url: "/notifications",
    tag: `easter-egg-${crypto.randomUUID()}`,
  });

  if (!result.ok && result.reason === "no_subscriptions" && body.subscription) {
    const fallbackResult = await sendPushToSubscription({
      subscription: body.subscription,
      title: "ReiLabs Easter Egg",
      body: message,
      url: "/notifications",
      tag: `easter-egg-${crypto.randomUUID()}`,
    });

    if (!fallbackResult.ok) {
      return NextResponse.json({ error: fallbackResult.reason }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message });
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === "no_subscriptions" ? 400 : 500 },
    );
  }

  return NextResponse.json({ ok: true, message });
}