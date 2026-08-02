// 지문 데이터 경계. public/data/reading/ 의 정적 JSON을 읽어 온다.
//
// 이 파일들은 GitHub Actions(.github/workflows/voa.yml)가 매일 VOA에서 모아 커밋한 것이다.
// VOA가 CORS 헤더를 주지 않아 브라우저가 직접 못 읽기 때문인데, 덕분에 여기서는 same-origin
// fetch 한 번이면 되고 서비스 워커 오프라인 캐시도 그대로 걸린다.

const BASE = "data/reading";

// 카테고리 라벨. scripts/voa-parse.js의 CATEGORIES와 id·라벨이 같아야 한다
// (수집 스크립트는 Node에서만 돌아 브라우저 번들과 모듈을 공유하지 않는다).
export const CATEGORIES = [
  { id: "science", label: "🔬 과학·기술" },
  { id: "health", label: "🩺 건강·생활" },
  { id: "education", label: "🎓 교육" },
  { id: "history", label: "🏛 미국 역사" },
  { id: "arts", label: "🎨 예술·문화" },
  { id: "society", label: "🌏 시사·사회" },
];

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

let indexPromise = null;

async function getJSON(path) {
  const res = await fetch(`${BASE}/${path}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`지문 데이터를 불러오지 못했습니다 (${res.status})`);
  return res.json();
}

/** 기사 목록. 한 세션에 한 번만 받아 재사용한다. 실패하면 다음 호출에서 다시 시도한다. */
export function loadIndex() {
  if (!indexPromise) {
    indexPromise = getJSON("index.json").catch((e) => {
      indexPromise = null;
      throw e;
    });
  }
  return indexPromise;
}

export async function articlesOf(categoryId) {
  const { articles } = await loadIndex();
  return articles.filter((a) => a.category === categoryId);
}

/** 지문 전문(문단·어휘 풀이·오디오 링크). */
export function loadArticle(id) {
  return getJSON(`${id}.json`);
}
