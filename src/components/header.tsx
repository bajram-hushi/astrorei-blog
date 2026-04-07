import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { isAllowedUser } from "@/lib/auth";
import { resolveProfile } from "@/lib/profile";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedUser(user)) {
    await supabase.auth.signOut();
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
    <header className="border-b border-zinc-800/20 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="inline-flex items-center" aria-label="ReiLabs home">
          <Image
            src="/reilabs-header-logo.svg"
            alt="ReiLabs"
            width={190}
            height={38}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <div className="flex items-center gap-3 text-sm">
          <Link href="/profile" className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-zinc-100">
            {resolved.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolved.avatarUrl}
                alt="Your avatar"
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-300 text-xs font-semibold text-zinc-700">
                {resolved.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="hidden text-zinc-600 sm:inline">{resolved.username}</span>
          </Link>
          <Link
            href="/new"
            className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100"
          >
            New Post
          </Link>
          <Link
            href="/profile"
            className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100"
          >
            Profile
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
