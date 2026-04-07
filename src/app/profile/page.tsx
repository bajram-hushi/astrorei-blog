import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { updateProfile } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { getDefaultUsername, resolveProfile } from "@/lib/profile";
import { ProfileAvatarField } from "@/components/profile-avatar-field";

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

function errorText(error?: string) {
  if (!error) {
    return "";
  }

  if (error === "invalid_username") {
    return "Username must be between 2 and 50 characters.";
  }

  return `Could not update profile: ${error}`;
}

export default async function ProfilePage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .schema("blog")
    .from("profiles")
    .select("id, email, username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const resolved = resolveProfile(user, profile);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-1 text-sm text-zinc-600">Customize how your identity appears across posts and comments.</p>

        {params.error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorText(params.error)}
          </p>
        )}

        {params.success && (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Profile updated.
          </p>
        )}

        <form action={updateProfile} className="mt-6 space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Username</span>
            <input
              name="username"
              required
              defaultValue={profile?.username ?? getDefaultUsername(user)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>

          <ProfileAvatarField defaultValue={profile?.avatar_url ?? ""} />

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-semibold text-zinc-600">Preview</p>
            <div className="mt-2 flex items-center gap-3">
              {resolved.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolved.avatarUrl} alt="Profile avatar" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-300 text-xs font-semibold text-zinc-700">
                  {resolved.username.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium">{resolved.username}</p>
                <p className="text-xs text-zinc-600">{user.email}</p>
              </div>
            </div>
          </div>

          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700">
            Save profile
          </button>
        </form>
      </main>
    </div>
  );
}
