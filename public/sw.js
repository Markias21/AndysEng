// 오프라인 앱 셸. 정적 자산만 캐시하고 API 호출(api.anthropic.com)은 절대 캐시하지 않는다.
const VERSION = "v18";
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
  "js/shared/date.js",
  "js/shared/cloze.js",
  "js/shared/cloze-view.js",
  "js/shared/pick.js",
  "js/shared/autosave.js",
  "js/shared/translate.js",
  "js/shared/supabase.js",
  "js/shared/usage.js",
  "js/features/conversation/ui.js",
  "js/features/conversation/topics.js",
  "js/features/conversation/hobby-topics.js",
  "js/features/conversation/categories.js",
  "js/shared/personas.js",
  "js/features/writing/ui.js",
  "js/features/writing/schema.js",
  "js/features/writing/qna.js",
  "js/features/writing/cloze-ui.js",
  "js/features/writing/prompts.js",
  "js/features/writing/structure.js",
  "js/features/writing/toefl.js",
  "js/features/writing/email.js",
  "js/features/writing/email-prompts.js",
  "js/features/writing/review-prompt.js",
  "js/features/writing-basic/ui.js",
  "js/features/writing-basic/templates.js",
  "js/features/writing-basic/difficulty.js",
  "js/features/writing-basic/essays.js",
  "js/features/writing-basic/essays-preference.js",
  "js/features/writing-basic/essays-agree.js",
  "js/features/writing-basic/essays-tradeoff.js",
  "js/features/writing-basic/essays-policy.js",
  "js/features/writing-basic/essays-email.js",
  "js/features/report/report.js",
  "js/features/report/ui.js",
  "js/features/stats/stats.js",
  "js/features/stats/chart.js",
  "js/features/stats/ui.js",
  "js/features/srs/scheduler.js",
  "js/features/srs/session.js",
  "js/features/srs/schema.js",
  "js/features/srs/labels.js",
  "js/features/srs/items.js",
  "js/features/srs/produce-ui.js",
  "js/features/srs/quiz.js",
  "js/features/srs/quiz-ui.js",
  "js/features/srs/history.js",
  "js/features/srs/history-ui.js",
  "js/features/reading/ui.js",
  "js/features/reading/practice-ui.js",
  "js/features/reading/result-ui.js",
  "js/features/reading/catalog.js",
  "js/features/reading/ai.js",
  "js/features/reading/schema.js",
  "js/features/reading/prompts.js",
  "js/features/reading/passage.js",
  "js/features/reading/score.js",
  "js/features/reading/types.js",
  "js/features/listening/ui.js",
  "js/features/listening/practice-ui.js",
  "js/features/listening/catalog.js",
  "js/shared/dictation.js",
  "js/shared/mcq.js",
  "js/shared/pdf-text.js",
  "js/features/sixmin/ui.js",
  "js/features/sixmin/practice-ui.js",
  "js/features/sixmin/dictation-ui.js",
  "js/features/sixmin/quiz-ui.js",
  "js/features/sixmin/catalog.js",
  "js/features/sixmin/source.js",
  "js/features/sixmin/transcript.js",
  "js/features/sixmin/segments.js",
  "js/features/sixmin/types.js",
  "js/features/sixmin/schema.js",
  "js/features/sixmin/prompts.js",
  "js/features/sixmin/ai.js",
  "js/features/short-reading/ui.js",
  "js/features/short-reading/items.js",
  "js/features/short-reading/items-science.js",
  "js/features/short-reading/items-health.js",
  "js/features/short-reading/items-education.js",
  "js/features/short-reading/items-history.js",
  "js/features/short-reading/items-arts.js",
  "js/features/short-reading/items-society.js",
  "js/features/short-reading/schema.js",
  "js/features/short-reading/prompts.js",
  "js/features/short-reading/grading.js",
  "js/features/srs/ui.js",
  "js/features/dictionary/detect.js",
  "js/features/dictionary/ui.js",
  "js/features/sync/ui.js",
  "js/features/translate/ui.js",
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
