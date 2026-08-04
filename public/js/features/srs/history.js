// 카드 하나의 복습 시도 기록(quiz records)을 뽑아 시간순으로 정렬한다.
// id가 있는 최신 기록은 id로, id가 없는 옛 기록(2026-08-04 이전)은 표현/단어 텍스트+종류로 대신 찾는다.
export function historyFor(records, item) {
  const matches = records.filter((r) => (r.id ? r.id === item.raw.id : r.kind === item.kind && r.expression === item.term));
  return matches
    .slice()
    .sort((a, b) => new Date(a.ts) - new Date(b.ts))
    .map((r, i) => ({ attempt: i + 1, ts: r.ts, correct: r.correct, score: r.score ?? null }));
}
