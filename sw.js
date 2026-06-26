// FutWord Service Worker
// Bump CACHE_VERSION whenever you deploy changes so clients fetch the new files.
const CACHE_VERSION = "futword-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json"
];

// Install: pre-cache core assets, activate immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

// Activate: clean up old caches, take control of open pages
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//  - HTML / navigation: network-first (so new versions load when online), fall back to cache offline.
//  - Everything else (fonts, images): cache-first, then network, then cache the result.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((net) => {
          const copy = net.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return net;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((net) => {
        if (net && net.status === 200) {
          const copy = net.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return net;
      }).catch(() => cached);
    })
  );
});

// Allow the page to trigger skipWaiting (used by the "update available" flow)
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

// Notification click: focus an existing window or open a new one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});

// Support for scheduled local notifications via the Notification Triggers API
// (progressive enhancement — only fires on browsers that support it)
self.addEventListener("notificationclose", () => {});
