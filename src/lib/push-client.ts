function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function browserSupportsPush() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function registerCurrentDeviceForPush(vapidPublicKey?: string) {
  if (!browserSupportsPush()) {
    return { ok: false as const, reason: "unsupported" as const };
  }

  if (!vapidPublicKey) {
    return { ok: false as const, reason: "missing_vapid_public_key" as const };
  }

  const requestedPermission = await Notification.requestPermission();
  if (requestedPermission !== "granted") {
    return { ok: false as const, reason: "permission_denied" as const };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      deviceLabel: window.navigator.platform || "browser",
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    return {
      ok: false as const,
      reason: (payload?.error || "subscription_save_failed") as string,
    };
  }

  return {
    ok: true as const,
    permission: requestedPermission,
    subscription: subscription.toJSON(),
  };
}

export async function disableCurrentDevicePush() {
  if (!browserSupportsPush()) {
    return { ok: false as const, reason: "unsupported" as const };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  const endpoint = subscription?.endpoint ?? null;

  if (subscription) {
    await subscription.unsubscribe();
  }

  const response = await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    return {
      ok: false as const,
      reason: (payload?.error || "subscription_disable_failed") as string,
    };
  }

  return { ok: true as const };
}