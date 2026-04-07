import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { getDefaultUsername, getGoogleAvatar } from "@/lib/profile";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_exchange_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedUser(user)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  if (user) {
    await supabase.schema("blog").from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? "unknown",
        username: getDefaultUsername(user),
        avatar_url: getGoogleAvatar(user),
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  }

  return NextResponse.redirect(`${origin}/`);
}
