import test from "node:test";
import assert from "node:assert/strict";
import { costUsd, estimateUsd } from "./usage.js";

test("costUsd: 입력·출력 토큰으로 비용을 계산한다", () => {
  const usage = { input_tokens: 1000, output_tokens: 1000 };
  // sonnet-5: input $3/M, output $15/M → (1000*3 + 1000*15) / 1e6
  assert.equal(costUsd("claude-sonnet-5", usage), 0.018);
});

test("costUsd: 캐시 읽기 토큰은 입력가의 0.1배로 계산한다", () => {
  const usage = { input_tokens: 0, cache_read_input_tokens: 1_000_000, output_tokens: 0 };
  assert.equal(costUsd("claude-sonnet-5", usage), 0.3); // 3 * 0.1
});

test("costUsd: 알 수 없는 모델이나 usage 없으면 0", () => {
  assert.equal(costUsd("unknown-model", { input_tokens: 1000 }), 0);
  assert.equal(costUsd("claude-sonnet-5", null), 0);
});

test("estimateUsd: 글자 수를 토큰으로 환산해 대략적인 비용을 낸다", () => {
  // 4000자 → 1000 입력 토큰, 출력 1000 토큰 → costUsd와 같은 산식
  const est = estimateUsd("claude-sonnet-5", { promptChars: 4000, estOutputTokens: 1000 });
  assert.equal(est, 0.018);
});

test("estimateUsd: 알 수 없는 모델이면 0", () => {
  assert.equal(estimateUsd("unknown-model", { promptChars: 4000, estOutputTokens: 1000 }), 0);
});
