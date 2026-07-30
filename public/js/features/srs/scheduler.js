// 복습 간격 스케줄링 도메인 로직. 순수 함수만 — 저장소/UI를 import하지 않는다.
// 망각곡선을 따라 간격 사다리를 오르는 단순 SM-2 변형:
// 정답이면 interval이 사다리를 한 칸 오르고, 오답이면 사다리를 여러 칸 내려간다.

/** 정답 연속 횟수(streak)에 따른 복습 간격(일). */
export const INTERVALS = [1, 3, 7, 14, 30, 60, 120];

/**
 * 오답 시 사다리에서 내려가는 칸 수. 완전 리셋(streak 0)이 아닌 이유는,
 * 120일까지 올라간 카드가 한 번 틀렸다고 1일로 추락하면 그 카드가 매일 되돌아와
 * 복습량을 부풀리기 때문이다(한 번의 실패로 기억이 0이 되지는 않는다).
 */
export const LAPSE_DROP = 4;

/** 누적 실패가 이 횟수에 닿으면 leech(아무리 해도 안 외워지는 카드)로 표시한다. */
export const LEECH_THRESHOLD = 8;

const DAY_MS = 24 * 60 * 60 * 1000;
const RELEARN_DAYS = 1; // 사다리 바닥까지 떨어진 카드는 다음 날 다시
const FUZZ = 0.15;

/**
 * 간격을 ±15% 흔든다. 간격이 완전히 결정론적이면 같은 날 함께 담은 카드들이
 * 영원히 같은 날 함께 돌아와 특정 날짜에 복습이 몰린다.
 * 3일 미만은 흔들 여지가 없어 그대로 둔다.
 */
export function fuzzInterval(days, rand = Math.random) {
  if (days < 3) return days;
  const spread = Math.round(days * FUZZ);
  const offset = Math.round(rand() * 2 * spread) - spread;
  return Math.max(1, days + offset);
}

/**
 * 복습 결과를 반영한 새 카드 상태를 반환한다. 원본은 바꾸지 않는다.
 * rand는 테스트에서 고정할 수 있도록 인자로 받는다(순수성 유지).
 */
export function review(card, correct, now, rand = Math.random) {
  const reps = (card.reps || 0) + 1;
  const streak = correct ? (card.streak || 0) + 1 : Math.max(0, (card.streak || 0) - LAPSE_DROP);
  const interval = streak === 0 ? RELEARN_DAYS : INTERVALS[Math.min(streak - 1, INTERVALS.length - 1)];
  const due = now + fuzzInterval(interval, rand) * DAY_MS;
  if (correct) return { ...card, reps, streak, interval, due };
  const lapses = (card.lapses || 0) + 1;
  return { ...card, reps, lapses, streak, interval, due, leech: lapses >= LEECH_THRESHOLD };
}

/** leech 안내를 본 뒤 계속 보기로 했을 때. 누적 실패를 지워 다시 8회 뒤에 묻는다. */
export function clearLeech(card) {
  return { ...card, lapses: 0, leech: false };
}

/** 숙련도 라벨. 간격 사다리에서 얼마나 올라왔는지를 유저 말로 보여준다. */
export function masteryLabel(card) {
  const streak = card.streak || 0;
  if (streak === 0) return "갓 배운";
  if (streak <= 2) return "아직 서툰";
  if (streak <= 4) return "숙달된";
  return "매우 숙달된";
}
