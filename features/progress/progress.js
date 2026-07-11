// 공부량/점수 집계 도메인 로직. 순수 함수만 — 프레임워크/저장소를 import하지 않는다.

/** 최근 n개 점수의 평균. 점수가 없으면 null. */
export function avgLastN(scores, n) {
  if (!Number.isInteger(n) || n <= 0) throw new Error("n은 1 이상의 정수여야 합니다.");
  const slice = scores.slice(-n);
  if (slice.length === 0) return null;
  const sum = slice.reduce((acc, s) => acc + s, 0);
  return Math.round((sum / slice.length) * 10) / 10;
}

/**
 * 기능 하나의 학습 기록 요약.
 * records: [{ts, score, ...}] (시간순)
 */
export function summarize(records) {
  const scores = records.map((r) => r.score);
  return {
    count: records.length,
    avg10: avgLastN(scores, 10),
    avg100: avgLastN(scores, 100),
    recentScores: scores.slice(-10),
  };
}
