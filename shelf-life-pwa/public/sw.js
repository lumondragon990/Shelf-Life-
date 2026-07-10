// Shelf Life service worker — makes the app installable and work offline.
// Strategy: cache the app shell on install; network-first for everything else
// so readers always get fresh data when online, and the app still opens offline.

const CACHE = "shelf-life-v1"; // bump this string on every deploy to invalidate old caches
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET; let API calls (POST etc.) pass through untouched
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache a copy of successful same-origin responses
        const copy = response.clone();
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        // Offline: serve from cache, falling back to the app shell for navigations
        caches.match(event.request).then(
          (cached) => cached || (event.request.mode === "navigate" ? caches.match("/") : undefined)
        )
      )
  );
});
