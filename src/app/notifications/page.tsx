import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { markAllNotificationsRead } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: "comment_on_post" | "reply_to_comment";
  post_id: string;
  comment_id: string;
  created_at: string;
  read_at: string | null;
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedUser(user)) {
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  const { data: notifications } = await supabase
    .schema("blog")
    .from("notifications")
    .select("id, recipient_id, actor_id, type, post_id, comment_id, created_at, read_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (notifications ?? []) as NotificationRow[];
  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id)));
  const postIds = Array.from(new Set(rows.map((row) => row.post_id)));

  let actorNameMap = new Map<string, string>();
  if (actorIds.length) {
    const { data: actors } = await supabase
      .schema("blog")
      .from("profiles")
      .select("id, username, email")
      .in("id", actorIds);

    actorNameMap = new Map(
      (actors ?? []).map((actor) => [actor.id, actor.username?.trim() || actor.email || "Someone"]),
    );
  }

  let postTitleMap = new Map<string, string>();
  if (postIds.length) {
    const { data: posts } = await supabase
      .schema("blog")
      .from("posts")
      .select("id, title")
      .in("id", postIds);

    postTitleMap = new Map((posts ?? []).map((post) => [post.id, post.title]));
  }

  const unreadCount = rows.filter((row) => !row.read_at).length;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-zinc-600">Updates about replies to your comments and comments on your posts.</p>
          </div>
          {unreadCount > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
              >
                Mark all as read ({unreadCount})
              </button>
            </form>
          )}
        </div>

        {!rows.length ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-600">
            No notifications yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const actorName = actorNameMap.get(row.actor_id) ?? "Someone";
              const postTitle = postTitleMap.get(row.post_id) ?? "a post";
              const message =
                row.type === "reply_to_comment"
                  ? `${actorName} replied to your comment on ${postTitle}`
                  : `${actorName} commented on your post ${postTitle}`;

              return (
                <li
                  key={row.id}
                  className={`rounded-lg border p-4 ${row.read_at ? "border-zinc-200 bg-white" : "border-zinc-300 bg-zinc-50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-800">{message}</p>
                      <p className="mt-1 text-xs text-zinc-500">{timeAgo(row.created_at)}</p>
                    </div>
                    {!row.read_at && (
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-white">New</span>
                    )}
                  </div>
                  <div className="mt-3">
                    <Link
                      href={`/post/${row.post_id}`}
                      className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
                    >
                      Open discussion
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
