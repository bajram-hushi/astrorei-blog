import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";

export const runtime = "nodejs";

type SubscriptionPayload = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { subscription?: SubscriptionPayload; deviceLabel?: string };
  const subscription = body.subscription;
  const endpoint = subscription?.endpoint?.trim();
  const p256dh = subscription?.keys?.p256dh?.trim();
  const auth = subscription?.keys?.auth?.trim();
  const deviceLabel = body.deviceLabel?.trim() || null;
  const userAgent = request.headers.get("user-agent");

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const { error } = await supabase.schema("blog").from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh_key: p256dh,
      auth_key: auth,
      device_label: deviceLabel,
      user_agent: userAgent,
      enabled: true,
      last_seen: new Date().toISOString(),
      failure_count: 0,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({ endpoint: null }))) as { endpoint?: string | null };
  const endpoint = body.endpoint?.trim();

  const query = supabase
    .schema("blog")
    .from("push_subscriptions")
    .update({ enabled: false, last_seen: new Date().toISOString() })
    .eq("user_id", user.id);

  const { error } = endpoint ? await query.eq("endpoint", endpoint) : await query;

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to disable subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
