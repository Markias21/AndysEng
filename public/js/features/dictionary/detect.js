// 사전 조회 방향 감지 도메인 로직. 순수 함수만 — UI/저장소/외부 서비스를 import하지 않는다.

// 한글 음절/자모 범위. 하나라도 있으면 한국어 질의로 본다.
const HANGUL = /[가-힣㄰-㆏]/;

/**
 * 질의가 한국어(뜻으로 영단어 찾기)인지 영어(뜻 조회)인지 판정한다.
 * 반환: "ko"(한→영) | "en"(영→한).
 */
export function detectDirection(query) {
  return HANGUL.test(query || "") ? "ko" : "en";
}

/** 캐시 키: 방향 + 소문자·공백 정리된 질의. 같은 단어를 한 키로 모은다. */
export function cacheKey(query) {
  const norm = (query || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${detectDirection(norm)}:${norm}`;
}
