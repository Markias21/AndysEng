// 날짜 경계 계산. 순수 함수만.
// 복습의 일일 상한과 통계의 일별 집계가 "하루"를 똑같이 끊어야 하므로 한 곳에 둔다.

/** ISO 타임스탬프를 서울 기준 날짜 문자열(YYYY-MM-DD)로. */
export function toSeoulDate(ts) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(ts));
}
