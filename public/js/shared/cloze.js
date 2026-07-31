// 문장에서 표현을 찾아 빈칸으로 뚫는 도메인 로직. 순수 함수만 — UI/저장소를 import하지 않는다.
//
// 문장을 그냥 읽는 것보다 표현을 직접 인출해 볼 때 훨씬 오래 남는다는 연구(빈칸 > 읽기)에 따라,
// 글쓰기(원어민 모범 답안)와 복습(카드 예문) 양쪽이 이 로직을 함께 쓴다.

const MARKERS = /\[\[|\]\]/g;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** 표시용 [[ ]] 마커를 걷어낸 순수 문장. */
function plainText(sentence) {
  return String(sentence ?? "").replace(MARKERS, "");
}

/** 단어 경계인가 (문자열 밖이거나 글자·숫자가 아님). "in"이 "interesting" 안에서 잡히지 않게 한다. */
function isBoundary(ch) {
  return ch === undefined || !WORD_CHAR.test(ch);
}

/** 단어 경계를 지키는 첫 등장 위치. 없으면 -1. */
function findFirst(haystack, needle) {
  let from = 0;
  for (;;) {
    const start = haystack.indexOf(needle, from);
    if (start < 0) return -1;
    if (isBoundary(haystack[start - 1]) && isBoundary(haystack[start + needle.length])) return start;
    from = start + 1;
  }
}

/** 이 문장에서 아직 쓰이지 않은 표현들의 등장 위치. 서로 겹치지 않게 앞선 것을 우선한다. */
function findHits(text, expressions, used) {
  const lower = text.toLowerCase();
  const hits = [];
  (expressions || []).forEach((expr, exprIndex) => {
    if (used.has(exprIndex)) return;
    const needle = String(expr?.expression ?? "").trim().toLowerCase();
    if (!needle) return;
    const start = findFirst(lower, needle);
    if (start < 0) return;
    const end = start + needle.length;
    if (hits.some((h) => start < h.end && h.start < end)) return;
    hits.push({ start, end, exprIndex, answer: text.slice(start, end) });
    used.add(exprIndex);
  });
  return hits.sort((a, b) => a.start - b.start);
}

/** 문장을 빈칸 위치에서 잘라 parts/blanks로 나눈다. parts[i] 뒤에 blanks[i]가 온다. */
function split(text, hits) {
  const parts = [];
  const blanks = [];
  let cursor = 0;
  for (const hit of hits) {
    parts.push(text.slice(cursor, hit.start));
    blanks.push({ answer: hit.answer, exprIndex: hit.exprIndex });
    cursor = hit.end;
  }
  parts.push(text.slice(cursor));
  return { parts, blanks };
}

/** 비교용 정규화: 소문자 · 연속 공백 1칸 · 양끝 공백과 구두점 제거. */
export function normalize(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * 원어민 모범 답안에서 표현을 찾아 빈칸으로 만든다.
 * sentences:   [{sentence, translation}] (구버전 문자열도 허용). sentence에 [[ ]] 마커가 있어도 된다.
 * expressions: [{expression, ...}] — 표현 하나는 전체에서 한 번만 빈칸이 된다.
 * 반환: [{ translation, parts: string[], blanks: [{answer, exprIndex}] }]
 *       parts.length === blanks.length + 1. 빈칸이 없는 문장은 blanks가 빈 배열이라 원문 그대로 남는다
 *       (앞뒤 맥락이 있어야 인출이 가능하므로 일부러 통째로 가리지 않는다).
 */
export function buildCloze(sentences, expressions) {
  const used = new Set();
  return (sentences || []).map((item) => {
    const isText = typeof item === "string";
    const text = plainText(isText ? item : item?.sentence);
    const translation = isText ? "" : (item?.translation ?? "");
    return { translation, ...split(text, findHits(text, expressions, used)) };
  });
}

/** 유저 입력이 정답인지. 빈 입력은 항상 오답. */
export function checkBlank(input, answer) {
  const got = normalize(input);
  return got !== "" && got === normalize(answer);
}

/** 표현을 띄어쓰기 단위로 나눈다. 빈칸을 단어별로 쪼개 개수와 길이를 보여 주기 위한 것. */
export function wordsOf(answer) {
  return String(answer ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** 단어별 입력이 각각 맞는지. 입력이 모자란 자리는 오답. */
export function checkWords(inputs, answer) {
  return wordsOf(answer).map((word, i) => checkBlank(inputs?.[i] ?? "", word));
}
