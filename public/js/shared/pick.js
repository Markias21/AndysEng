// 로컬 데이터 풀에서 "최근에 쓰지 않은" 항목을 뽑는 순수 함수.
// 회화 주제, 글쓰기 질문, 표현을 로컬에서 고를 때 공통으로 쓴다 (AI 호출 없이).

/**
 * pool에서 recentKeys에 없는 항목 중 하나를 무작위로 고른다.
 * 모든 항목이 최근에 쓰였으면(신선한 후보가 없으면) 전체 pool에서 고른다.
 * @param {Array} pool 후보 목록
 * @param {Iterable} recentKeys 최근에 사용한 키들
 * @param {(item:any)=>any} keyOf 항목에서 비교 키를 뽑는 함수 (기본: 항목 자체)
 */
export function pickFresh(pool, recentKeys, keyOf = (x) => x) {
  if (!pool || pool.length === 0) return null;
  const recent = new Set(recentKeys);
  const fresh = pool.filter((item) => !recent.has(keyOf(item)));
  const candidates = fresh.length ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** pool에서 중복 없이 무작위로 n개를 고른다 (n이 pool보다 크면 pool 전체를 섞어 반환). */
export function sampleN(pool, n) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
