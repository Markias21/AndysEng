// 복습 화면에서 쓰는 표시용 헬퍼. 저장소를 모르고, 받은 값만 문자열로 바꾼다.
import { LEECH_THRESHOLD } from "./scheduler.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function nounFor(kind) {
  return kind === "word" ? "단어" : "표현";
}

/** 받침 유무에 맞는 조사를 붙인다 (표현→표현으로/표현을, 단어→단어로/단어를). */
export function withParticle(noun, afterJong, afterVowel) {
  const code = noun.charCodeAt(noun.length - 1) - 0xac00;
  const hasJong = code >= 0 && code <= 11171 && code % 28 !== 0;
  return noun + (hasJong ? afterJong : afterVowel);
}

export function dueLabel(card, now) {
  if (card.due <= now) return `<span class="due-now">지금</span>`;
  const days = Math.ceil((card.due - now) / DAY_MS);
  return `${days}일 후`;
}

export function leechBadge(card) {
  return card.leech ? ` <span class="leech-badge" title="${LEECH_THRESHOLD}번 넘게 놓친 항목이에요">⚠️ 잘 안 외워져요</span>` : "";
}
