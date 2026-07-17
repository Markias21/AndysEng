// 오프라인 앱 셸. 정적 자산만 캐시하고 API 호출(api.anthropic.com)은 절대 캐시하지 않는다.
const VERSION = "v1";
const CACHE = `andyseng-${VERSION}`;
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-maskable.svg",
  "js/app.js",
  "js/shared/dom.js",
  "js/shared/keyvault.js",
  "js/shared/claude.js",
  "js/shared/store.js",
  "js/shared/localfs.js",
  "js/features/conversation/ui.js",
  "js/features/writing/ui.js",
  "js/features/expression/ui.js",
  "js/features/report/report.js",
  "js/features/report/ui.js",
  "js/features/stats/stats.js",
  "js/features/stats/chart.js",
  "js/features/stats/ui.js",
  "js/features/srs/scheduler.js",
  "js/features/srs/cloze.js",
  "js/features/srs/ui.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
