// 복습 간격 스케줄링 도메인 로직. 순수 함수만 — 저장소/UI를 import하지 않는다.
// 망각곡선을 따라 간격 사다리를 오르는 단순 SM-2 변형:
// 정답이면 interval이 사다리를 한 칸 오르고, 오답이면 처음으로 돌아간다.

/** 정답 연속 횟수(streak)에 따른 복습 간격(일). */
export const INTERVALS = [1, 3, 7, 14, 30, 60, 120];

const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000; // 오답은 10분 뒤 같은 세션에서 재도전

/** 복습 결과를 반영한 새 카드 상태를 반환한다. 원본은 바꾸지 않는다. */
export function review(card, correct, now) {
  if (!correct) {
    return { ...card, streak: 0, interval: 0, due: now + RETRY_MS };
  }
  const streak = card.streak + 1;
  const interval = INTERVALS[Math.min(streak - 1, INTERVALS.length - 1)];
  return { ...card, streak, interval, due: now + interval * DAY_MS };
}

/** 지금 복습할 카드들 (due 지난 순). */
export function dueCards(deck, now) {
  return deck.filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
}
