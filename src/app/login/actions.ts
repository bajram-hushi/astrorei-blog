"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function appUrl() {
  const fallback = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (fallback) {
    return fallback.replace(/\/+$/, "");
  }

  return "http://localhost:3333";
}

export async function loginWithGoogle() {
  const supabase = await createClient();
  const origin = appUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google_login_failed");
  }

  redirect(data.url);
}

function assertAstroreiEmail(email: string) {
  if (!email.toLowerCase().endsWith("@astrorei.io")) {
    throw new Error("Only @astrorei.io accounts are allowed for Astrorei login.");
  }
}

export async function loginWithAstrorei(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    assertAstroreiEmail(email);
  } catch {
    redirect("/login?error=astrorei_domain_only");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=astrorei_login_failed");
  }

  redirect("/");
}

export async function signUpAstrorei(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    assertAstroreiEmail(email);
  } catch {
    redirect("/login?error=astrorei_domain_only");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  });

  if (error) {
    redirect("/login?error=astrorei_signup_failed");
  }

  redirect("/login?message=check_email_for_confirmation");
}
