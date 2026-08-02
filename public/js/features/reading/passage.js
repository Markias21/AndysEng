// 지문 텍스트를 다루는 도메인 로직. 순수 함수만 — UI/저장소/AI를 import하지 않는다.

/** 본문 문단(소제목 제외)만 이어 붙인 지문 전문. AI에 넘기거나 문장을 찾을 때 쓴다. */
export function bodyText(article) {
  return (article?.paragraphs || [])
    .filter((p) => p.type === "para")
    .map((p) => p.text)
    .join("\n\n");
}

// 약어(Mr. Dr. U.S. 등) 뒤에서 끊기지 않도록, 마침표 다음이 공백+대문자일 때만 문장을 나눈다.
// 완벽한 문장 분리기는 필요 없다 — 표현이 들어 있는 문장을 되찾는 용도라 조금 길어도 상관없다.
const SENTENCE_END = /(?<=[.!?]["”’)]?)\s+(?=[“"‘(]?[A-Z0-9])/;
const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|U\.K)\.$/;

function splitSentences(text) {
  const out = [];
  for (const piece of text.split(SENTENCE_END)) {
    const prev = out[out.length - 1];
    // 약어로 끝나 잘못 끊긴 조각은 앞 문장에 도로 붙인다.
    if (prev && ABBREV.test(prev)) out[out.length - 1] = `${prev} ${piece}`;
    else out.push(piece);
  }
  return out;
}

/**
 * 지문을 문장 단위로 나눈다. 문단을 넘어 이어 붙이지 않는다 — 소제목은 마침표가 없어서
 * 통째로 이으면 다음 문단 첫 문장에 들러붙는다. 소제목 자체는 예문이 될 수 없으니 제외한다.
 */
export function sentencesOf(article) {
  return (article?.paragraphs || [])
    .filter((p) => p.type === "para")
    .flatMap((p) => splitSentences(p.text))
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 이 표현이 실제로 등장한 문장을 지문에서 찾는다. 없으면 null.
 * AI가 표현만 돌려주게 하고 영어 문장은 여기서 되찾아, 지문을 그대로 복사해 오는 출력 토큰을 아낀다.
 */
export function sentenceContaining(article, expression) {
  const needle = String(expression ?? "").toLowerCase().trim();
  if (!needle) return null;
  return sentencesOf(article).find((s) => s.toLowerCase().includes(needle)) ?? null;
}

/**
 * 빈칸 항목에 지문 속 예문을 채워 넣는다. 지문에서 찾지 못한 표현은 버린다
 * (빈칸을 뚫을 자리가 없으면 문제가 성립하지 않는다).
 * blanks: [{expression, meaning, sentence_ko, level, non_literal}]
 * 반환: 같은 항목 + { sentence }
 */
export function resolveBlanks(article, blanks) {
  return (blanks || [])
    .map((b) => ({ ...b, sentence: sentenceContaining(article, b.expression) }))
    .filter((b) => b.sentence);
}
