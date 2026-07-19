// AI 호출 비용 계산 도메인 로직. 모델별 100만 토큰당 가격(달러, 2026-07 기준 추정치)으로 순수 계산한다.
const PRICING_USD_PER_MTOK = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

/** 캐시 읽기 토큰은 입력가의 약 0.1배로 청구된다. */
const CACHE_READ_DISCOUNT = 0.1;

export function costUsd(model, usage) {
  const price = PRICING_USD_PER_MTOK[model];
  if (!price || !usage) return 0;
  const input = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  const cacheRead = usage.cache_read_input_tokens || 0;
  const output = usage.output_tokens || 0;
  return (input * price.input + cacheRead * price.input * CACHE_READ_DISCOUNT + output * price.output) / 1_000_000;
}
