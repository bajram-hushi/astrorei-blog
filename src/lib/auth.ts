import { User } from "@supabase/supabase-js";

export function isAllowedUser(user: User | null): boolean {
  if (!user) {
    return false;
  }

  const email = user.email?.toLowerCase() ?? "";
  const provider = user.app_metadata?.provider;

  return provider === "google" || email.endsWith("@astrorei.io");
}
