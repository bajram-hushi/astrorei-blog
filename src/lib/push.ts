import webpush, { type PushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

type ClientPushSubscription = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

type NotificationInsertRow = {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: "comment_on_post" | "reply_to_comment";
  post_id: string;
  comment_id: string;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  enabled: boolean;
  device_label: string | null;
  user_agent: string | null;
  last_push_sent_at: string | null;
  failure_count: number;
};

type PushDeliveryRow = {
  notification_id: string;
  subscription_id: string;
};

const PUSH_COOLDOWN_MS = 30_000;

function resolveVapidSubject() {
  const rawSubject = process.env.VAPID_SUBJECT?.trim();

  if (!rawSubject) {
    return "mailto:reilabs@astrorei.io";
  }

  if (rawSubject.startsWith("mailto:")) {
    return rawSubject;
  }

  try {
    const parsed = new URL(rawSubject);
    return parsed.toString();
  } catch {
    if (rawSubject.includes("@")) {
      return `mailto:${rawSubject}`;
    }

    return "mailto:reilabs@astrorei.io";
  }
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = resolveVapidSubject();

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function buildNotificationPayload(params: {
  notification: NotificationInsertRow;
  actorName: string;
  postTitle: string;
}) {
  const title =
    params.notification.type === "reply_to_comment"
      ? "Nuova risposta al tuo commento"
      : "Nuovo commento sul tuo post";
  const body =
    params.notification.type === "reply_to_comment"
      ? `${params.actorName} ha risposto su ${params.postTitle}`
      : `${params.actorName} ha commentato ${params.postTitle}`;

  return {
    title,
    body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    url: `/post/${params.notification.post_id}`,
    tag: `notification-${params.notification.id}`,
    notificationId: params.notification.id,
  };
}

function normalizeClientSubscription(subscription?: ClientPushSubscription | null): PushSubscription | null {
  const endpoint = subscription?.endpoint?.trim();
  const p256dh = subscription?.keys?.p256dh?.trim();
  const auth = subscription?.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  } satisfies PushSubscription;
}

export async function sendPushToSubscription(params: {
  subscription?: ClientPushSubscription | null;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  if (!configureWebPush()) {
    return { ok: false as const, reason: "missing_vapid" as const };
  }

  const subscription = normalizeClientSubscription(params.subscription);
  if (!subscription) {
    return { ok: false as const, reason: "invalid_subscription" as const };
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: params.title,
        body: params.body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        url: params.url || "/notifications",
        tag: params.tag || `easter-egg-${Date.now()}`,
      }),
    );

    return { ok: true as const };
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : null;
    return {
      ok: false as const,
      reason: statusCode === 404 || statusCode === 410 ? "invalid_subscription" : "push_send_failed",
    };
  }
}

export async function sendPushToUser(params: {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  if (!configureWebPush()) {
    return { ok: false as const, reason: "missing_vapid" as const };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false as const, reason: "missing_admin" as const };
  }

  const { data: subscriptions } = await admin
    .schema("blog")
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key, failure_count")
    .eq("user_id", params.userId)
    .eq("enabled", true);

  const rows = (subscriptions ?? []) as Array<{
    id: string;
    endpoint: string;
    p256dh_key: string;
    auth_key: string;
    failure_count: number;
  }>;

  if (!rows.length) {
    return { ok: false as const, reason: "no_subscriptions" as const };
  }

  for (const subscription of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key,
          },
        } satisfies PushSubscription,
        JSON.stringify({
          title: params.title,
          body: params.body,
          icon: "/icon.svg",
          badge: "/icon.svg",
          url: params.url || "/notifications",
          tag: params.tag || `easter-egg-${Date.now()}`,
        }),
      );

      await admin
        .schema("blog")
        .from("push_subscriptions")
        .update({
          last_push_sent_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          failure_count: 0,
        })
        .eq("id", subscription.id);
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : null;
      const isInvalidSubscription = statusCode === 404 || statusCode === 410;

      await admin
        .schema("blog")
        .from("push_subscriptions")
        .update({
          enabled: isInvalidSubscription ? false : true,
          last_seen: new Date().toISOString(),
          failure_count: subscription.failure_count + 1,
        })
        .eq("id", subscription.id);
    }
  }

  return { ok: true as const };
}

export async function sendPushNotificationsForNotifications(notifications: NotificationInsertRow[]) {
  if (!notifications.length || !configureWebPush()) {
    return;
  }

  const admin = createAdminClient();
  if (!admin) {
    return;
  }

  const recipientIds = Array.from(new Set(notifications.map((notification) => notification.recipient_id)));
  const actorIds = Array.from(new Set(notifications.map((notification) => notification.actor_id)));
  const postIds = Array.from(new Set(notifications.map((notification) => notification.post_id)));

  const [{ data: subscriptions }, { data: profiles }, { data: posts }, { data: deliveries }] = await Promise.all([
    admin
      .schema("blog")
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh_key, auth_key, enabled, device_label, user_agent, last_push_sent_at, failure_count")
      .in("user_id", recipientIds)
      .eq("enabled", true),
    admin.schema("blog").from("profiles").select("id, username, email").in("id", actorIds),
    admin.schema("blog").from("posts").select("id, title").in("id", postIds),
    admin
      .schema("blog")
      .from("notification_push_deliveries")
      .select("notification_id, subscription_id")
      .in("notification_id", notifications.map((notification) => notification.id)),
  ]);

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
    const existing = subscriptionsByUser.get(subscription.user_id) ?? [];
    existing.push(subscription);
    subscriptionsByUser.set(subscription.user_id, existing);
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.username?.trim() || profile.email || "Qualcuno"]),
  );
  const postMap = new Map((posts ?? []).map((post) => [post.id, post.title]));
  const sentPairs = new Set(
    ((deliveries ?? []) as PushDeliveryRow[]).map((delivery) => `${delivery.notification_id}:${delivery.subscription_id}`),
  );

  for (const notification of notifications) {
    const recipientSubscriptions = subscriptionsByUser.get(notification.recipient_id) ?? [];

    for (const subscription of recipientSubscriptions) {
      const dedupeKey = `${notification.id}:${subscription.id}`;
      if (sentPairs.has(dedupeKey)) {
        continue;
      }

      if (subscription.last_push_sent_at) {
        const lastSentAt = new Date(subscription.last_push_sent_at).getTime();
        if (!Number.isNaN(lastSentAt) && Date.now() - lastSentAt < PUSH_COOLDOWN_MS) {
          continue;
        }
      }

      const payload = buildNotificationPayload({
        notification,
        actorName: profileMap.get(notification.actor_id) ?? "Qualcuno",
        postTitle: postMap.get(notification.post_id) ?? "un post",
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh_key,
              auth: subscription.auth_key,
            },
          } satisfies PushSubscription,
          JSON.stringify(payload),
        );

        await admin.schema("blog").from("notification_push_deliveries").insert({
          notification_id: notification.id,
          subscription_id: subscription.id,
          status: "sent",
          response_code: 201,
        });

        await admin
          .schema("blog")
          .from("push_subscriptions")
          .update({
            last_push_sent_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            failure_count: 0,
          })
          .eq("id", subscription.id);
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : null;
        const isInvalidSubscription = statusCode === 404 || statusCode === 410;
        const errorMessage = error instanceof Error ? error.message : "push_send_failed";

        await admin.schema("blog").from("notification_push_deliveries").insert({
          notification_id: notification.id,
          subscription_id: subscription.id,
          status: isInvalidSubscription ? "invalid" : "failed",
          response_code: statusCode,
          error_message: errorMessage,
        });

        if (isInvalidSubscription) {
          await admin
            .schema("blog")
            .from("push_subscriptions")
            .update({
              enabled: false,
              last_seen: new Date().toISOString(),
              failure_count: subscription.failure_count + 1,
            })
            .eq("id", subscription.id);
        } else {
          await admin
            .schema("blog")
            .from("push_subscriptions")
            .update({
              last_seen: new Date().toISOString(),
              failure_count: subscription.failure_count + 1,
            })
            .eq("id", subscription.id);
        }
      }
    }
  }
}
