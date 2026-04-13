import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { PushNotificationsToggle } from "@/components/push-notifications-toggle";
import { markAllNotificationsRead } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}g fa`;
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

  const { count: enabledPushSubscriptions } = await supabase
    .schema("blog")
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("enabled", true);

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
      (actors ?? []).map((actor) => [
        actor.id,
        actor.username?.trim() || actor.email || "Qualcuno",
      ]),
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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notifiche</h1>
            <p className="text-sm text-zinc-600">
              Aggiornamenti su risposte ai tuoi commenti e commenti ai tuoi
              post.
            </p>
          </div>
          {unreadCount > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="inline-flex w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
              >
                Segna tutti come letti ({unreadCount})
              </button>
            </form>
          )}
        </div>

        <div className="mb-6">
          <PushNotificationsToggle
            initialEnabled={Boolean(
              enabledPushSubscriptions && enabledPushSubscriptions > 0,
            )}
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()}
          />
        </div>

        {!rows.length ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-600">
            Nessuna notifica ancora.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const actorName = actorNameMap.get(row.actor_id) ?? "Qualcuno";
              const postTitle = postTitleMap.get(row.post_id) ?? "un post";
              const message =
                row.type === "reply_to_comment"
                  ? `${actorName} ha risposto al tuo commento su ${postTitle}`
                  : `${actorName} ha commentato il tuo post ${postTitle}`;

              return (
                <li
                  key={row.id}
                  className={`rounded-lg border p-4 ${row.read_at ? "border-zinc-200 bg-white" : "border-zinc-300 bg-zinc-50"}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-zinc-800">{message}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {timeAgo(row.created_at)}
                      </p>
                    </div>
                    {!row.read_at && (
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-white">
                        Nuovo
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <Link
                      href={`/post/${row.post_id}`}
                      className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
                    >
                      Apri la discussione
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
