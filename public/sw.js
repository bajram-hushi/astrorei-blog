const CACHE_NAME = "reilabs-static-v2";
const STATIC_DESTINATIONS = new Set(["style", "script", "font", "image"]);

function getNotificationPayload(event) {
  if (!event.data) {
    return {
      title: "ReiLabs",
      body: "Hai una nuova notifica.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      url: "/notifications",
      tag: "reilabs-notification",
    };
  }

  try {
    return event.data.json();
  } catch {
    return {
      title: "ReiLabs",
      body: event.data.text() || "Hai una nuova notifica.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      url: "/notifications",
      tag: "reilabs-notification",
    };
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip caching JavaScript chunks to prevent stale module issues
  if (request.destination === "script" && url.pathname.includes("/_next/")) {
    return;
  }

  if (!STATIC_DESTINATIONS.has(request.destination)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      if (cached) {
        void fetch(request)
          .then((response) => {
            if (response.ok) {
              void cache.put(request, response.clone());
            }
          })
          .catch(() => {
            return undefined;
          });

        return cached;
      }

      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});

self.addEventListener("push", (event) => {
  const payload = getNotificationPayload(event);

  event.waitUntil(
    self.registration.showNotification(payload.title || "ReiLabs", {
      body: payload.body || "Hai una nuova notifica.",
      icon: payload.icon || "/icon.svg",
      badge: payload.badge || "/icon.svg",
      tag: payload.tag || `notification-${Date.now()}`,
      data: {
        url: payload.url || "/notifications",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.includes(self.location.origin));

      if (existingClient) {
        existingClient.navigate(targetUrl);
        return existingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
