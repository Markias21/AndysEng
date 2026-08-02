// 짧은 학습 데이터 경계. public/data/listening/ 의 정적 JSON을 읽어 온다.
//
// 이 파일들은 GitHub Actions(.github/workflows/voa.yml)가 매일 VOA "Words and Their Stories"에서
// 모아 커밋한 것이다(리딩과 같은 이유로 same-origin fetch — VOA가 CORS 헤더를 주지 않는다).
const BASE = "data/listening";

// 지금은 카테고리가 하나뿐이다(관용구 이야기). scripts/voa-parse.js의 LISTENING_CATEGORIES와
// id·라벨이 같아야 한다(수집 스크립트는 Node에서만 돌아 브라우저 번들과 모듈을 공유하지 않는다).
export const CATEGORIES = [{ id: "idioms", label: "🗣 관용구 이야기" }];

let indexPromise = null;

async function getJSON(path) {
  const res = await fetch(`${BASE}/${path}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`짧은 학습 데이터를 불러오지 못했습니다 (${res.status})`);
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
  return categoryId ? articles.filter((a) => a.category === categoryId) : articles;
}

/** 지문 전문(문단·어휘 풀이·오디오 링크). */
export function loadArticle(id) {
  return getJSON(`${id}.json`);
}
