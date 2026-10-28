// Maktab-E-Khaleel service worker: lets the app open instantly and work offline.
// Bump CACHE_VERSION whenever you deploy a new version of the app.
const CACHE_VERSION = "v4";
const CACHE = "maktab-e-khaleel-" + CACHE_VERSION;
const SHELL = ["./", "./index.html", "./manifest.json", "./css/tailwind.css", "./icons/icon-192.png", "./icons/icon-512.png"];
const CDN_ASSETS = [];
const CACHEABLE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"]; // web fonts: cached after first view

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Optional extra assets (none right now); a failure here must not block install
    await Promise.all(CDN_ASSETS.map((u) => cache.add(new Request(u, { mode: "no-cors" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("maktab-e-khaleel-") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CACHEABLE_HOSTS.includes(url.hostname)) return; // never touch other sites (e.g. WhatsApp links)
  event.respondWith(staleWhileRevalidate(event, req));
});

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
  const network = fetch(req).then((res) => {
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  if (cached) {
    event.waitUntil(network); // refresh in the background for next launch
    return cached;
  }
  const res = await network;
  if (res) return res;
  if (req.mode === "navigate") {
    const shell = await cache.match("./index.html");
    if (shell) return shell;
  }
  return Response.error(); // never answer a script/style request with an HTML page
}
