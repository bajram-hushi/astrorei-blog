import { User } from "@supabase/supabase-js";

export type BlogProfile = {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
};

export function getGoogleAvatar(user: User): string | null {
  const metadata = user.user_metadata ?? {};
  const avatar = metadata.picture ?? metadata.avatar_url ?? null;

  return typeof avatar === "string" && avatar.length > 0 ? avatar : null;
}

export function getDefaultUsername(user: User): string {
  const metadata = user.user_metadata ?? {};
  const fromMeta = metadata.full_name ?? metadata.name;

  if (typeof fromMeta === "string" && fromMeta.trim()) {
    return fromMeta.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "user";
}

export function resolveProfile(user: User, profile: BlogProfile | null) {
  return {
    username: profile?.username?.trim() || getDefaultUsername(user),
    avatarUrl: profile?.avatar_url?.trim() || getGoogleAvatar(user),
  };
}
