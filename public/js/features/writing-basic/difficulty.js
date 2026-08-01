// 난이도별로 어떤 빈칸을 뚫을지 고르는 도메인 로직. 순수 함수만 — UI/저장소를 import하지 않는다.
//
// 빈칸마다 level(1~3)이 붙어 있고 고른 난이도 이하를 모두 뚫는다. 그래서 상급 ⊃ 중급 ⊃ 초급이
// 데이터 구조상 저절로 보장된다 — 초급에서 익힌 뼈대는 상급에서도 계속 인출하게 된다.
// level 1 = 글의 뼈대(신호어), 2 = 핵심 연어, 3 = 학술 어휘·긴 청크.

export const DIFFICULTIES = [
  { id: "basic", label: "🌱 초급", maxLevel: 1, ko: "글의 뼈대가 되는 신호어만" },
  { id: "mid", label: "🌿 중급", maxLevel: 2, ko: "뼈대 + 핵심 연어" },
  { id: "high", label: "🌳 상급", maxLevel: 3, ko: "학술 어휘와 긴 표현까지" },
];

export const DEFAULT_DIFFICULTY = "mid";

export function findDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) || null;
}

/**
 * 이 난이도에서 뚫을 빈칸들. 본문 등장 순서를 유지한다
 * (buildCloze가 겹치는 표현 중 앞선 것을 우선하므로 순서가 곧 우선순위다).
 * 모르는 난이도 id면 기본 난이도로 본다.
 */
export function blanksFor(essay, difficultyId) {
  const max = (findDifficulty(difficultyId) || findDifficulty(DEFAULT_DIFFICULTY)).maxLevel;
  return (essay?.blanks || []).filter((b) => b.level <= max);
}

/** 이 난이도의 빈칸 개수. 지문 목록에서 난이도를 가늠하게 해 준다. */
export function blankCount(essay, difficultyId) {
  return blanksFor(essay, difficultyId).length;
}
