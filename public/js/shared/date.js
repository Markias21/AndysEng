// 날짜 경계 계산. 순수 함수만.
// 복습의 일일 상한과 통계의 일별 집계가 "하루"를 똑같이 끊어야 하므로 한 곳에 둔다.

/** ISO 타임스탬프를 서울 기준 날짜 문자열(YYYY-MM-DD)로. */
export function toSeoulDate(ts) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(ts));
}

/**
 * 서울 날짜 키("YYYY-MM-DD")가 속한 주(월~일)의 범위.
 * → { start, end, dayIndex } (dayIndex: 월=0 … 일=6)
 * 날짜만 다루므로 UTC 산술로 계산한다(서울은 DST가 없고, 키 자체가 이미 서울 날짜다).
 */
export function weekRange(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const dayIndex = (new Date(base).getUTCDay() + 6) % 7; // 일(0)을 주의 끝으로 옮긴다
  const start = base - dayIndex * 86400000;
  const key = (ms) => new Date(ms).toISOString().slice(0, 10);
  return { start: key(start), end: key(start + 6 * 86400000), dayIndex };
}
