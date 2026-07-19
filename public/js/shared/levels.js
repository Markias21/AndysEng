// CEFR 레벨 도메인 로직. 순수 함수만 — UI/저장소를 import하지 않는다.
// 유저가 고른 레벨(A1~C2)이 회화 난이도·글쓰기 팁·복습 표현 범위에 공통으로 쓰인다.

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const DEFAULT_LEVEL = "B1";

/** 레벨의 순서 인덱스(0~5). 알 수 없는 값은 -1. */
export function levelIndex(level) {
  return CEFR_LEVELS.indexOf(level);
}

/** 유효한 CEFR 레벨인지. */
export function isLevel(level) {
  return levelIndex(level) >= 0;
}

/** 두 레벨의 거리(칸 수). 알 수 없는 값이 있으면 Infinity. */
export function levelDistance(a, b) {
  const ia = levelIndex(a);
  const ib = levelIndex(b);
  if (ia < 0 || ib < 0) return Infinity;
  return Math.abs(ia - ib);
}

/**
 * 유저 레벨 근처(±span)의 카드만 남긴다. 기본 span=1 (내 레벨 ±1).
 * 레벨 정보가 없는 카드(예: 이 기능 이전에 쌓인 글쓰기 카드)는 항상 포함한다.
 */
export function filterByLevel(cards, userLevel, span = 1) {
  if (!isLevel(userLevel)) return cards.slice();
  return cards.filter((c) => !c.level || levelDistance(c.level, userLevel) <= span);
}

// 글쓰기 팁: 레벨별 적절한 분량·구체성 가이드. 유저가 자기 레벨의 목표를 알 수 있게 화면에 노출한다.
export const WRITING_TIPS = {
  A1: "자신의 주장을 간결한 1문장으로 말해 보세요.",
  A2: "주장 1문장 + 이유 1문장, 총 2문장으로 써 보세요.",
  B1: "3~4문장으로, 주장과 이유 1~2가지를 제시하며 마무리하세요.",
  B2: "6문장 이상으로, 간결한 주장과 이를 구체화하는 근거 2가지를 제시하며 글을 완결하세요.",
  C1: "6~8문장으로, 주장·근거 2가지·예상 반론 반박까지 담아 논리적으로 전개하세요.",
  C2: "8문장 이상으로, 정교한 어휘와 다양한 문장 구조로 근거와 반론을 균형 있게 다루며 완결하세요.",
};

// 회화 지도용 레벨 설명. AI 파트너가 이 레벨에 맞춰 어휘·질문 난이도를 조절하도록 시스템 프롬프트에 넣는다.
export const CONV_GUIDANCE = {
  A1: "very simple, short questions with basic everyday vocabulary (e.g. 'Do you like coffee?')",
  A2: "simple everyday questions in short sentences",
  B1: "everyday questions with some follow-up, moderate vocabulary",
  B2: "opinion questions that ask for reasons, richer vocabulary (e.g. 'What do you think about remote work?')",
  C1: "abstract or nuanced questions that invite argument (e.g. 'What do you think about social media?')",
  C2: "complex, abstract questions with idiomatic, sophisticated language",
};
