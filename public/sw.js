// 오프라인 앱 셸. 정적 자산만 캐시하고 API 호출(api.anthropic.com)은 절대 캐시하지 않는다.
const VERSION = "v5";
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
  "js/shared/levels.js",
  "js/shared/scoring.js",
  "js/features/conversation/ui.js",
  "js/features/writing/ui.js",
  "js/features/report/report.js",
  "js/features/report/ui.js",
  "js/features/stats/stats.js",
  "js/features/stats/chart.js",
  "js/features/stats/ui.js",
  "js/features/srs/scheduler.js",
  "js/features/srs/ui.js",
  "js/features/words/ui.js",
  "js/features/dictionary/detect.js",
  "js/features/dictionary/ui.js",
  "js/features/settings/ui.js",
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

// 네트워크 우선 + 캐시 보강(오프라인 폴백). 캐시 우선 방식은 배포 직후에도 새로고침이
// 예전 버전을 계속 보여주는 문제(서비스 워커가 활성화되기 전까지 최소 한 번은 구버전을
// 캐시에서 응답)가 있어, 온라인일 땐 항상 최신을 받고 오프라인일 때만 캐시로 폴백한다.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
