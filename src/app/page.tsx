import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { BlogProfile } from "@/lib/profile";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedUser(user)) {
    redirect("/login");
  }

  const { data: posts } = await supabase
    .schema("blog")
    .from("posts")
    .select("id, title, created_at, author_id, author_email")
    .order("created_at", { ascending: false });

  const authorIds = Array.from(new Set((posts ?? []).map((post) => post.author_id)));
  let profileMap = new Map<string, BlogProfile>();

  if (authorIds.length) {
    const { data: profiles } = await supabase
      .schema("blog")
      .from("profiles")
      .select("id, email, username, avatar_url")
      .in("id", authorIds);

    profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile as BlogProfile]));
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Recent Posts</h1>
          <Link
            href="/new"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700"
          >
            Create Post
          </Link>
        </div>

        <div className="space-y-4">
          {posts?.map((post) => (
            <article key={post.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <Link href={`/post/${post.id}`} className="text-lg font-semibold hover:underline">
                {post.title}
              </Link>
              <div className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
                {profileMap.get(post.author_id)?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileMap.get(post.author_id)?.avatar_url ?? ""}
                    alt="Author avatar"
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-300 text-[10px] font-semibold text-zinc-700">
                    {(profileMap.get(post.author_id)?.username ?? post.author_email ?? "u")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                )}
                <span>
                  {new Date(post.created_at).toLocaleString()} - {profileMap.get(post.author_id)?.username ?? post.author_email}
                </span>
              </div>
            </article>
          ))}

          {!posts?.length && (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-600">
              No posts yet. Create your first internal post.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
