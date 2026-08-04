import { test } from "node:test";
import assert from "node:assert/strict";
import { historyFor } from "./history.js";

const item = { kind: "expression", term: "hit the sack", raw: { id: "c1" } };

test("historyFor: id로 매칭하고 시간순으로 시도 번호를 매긴다", () => {
  const records = [
    { id: "c1", ts: "2026-07-20T00:00:00Z", correct: false, kind: "expression", expression: "hit the sack" },
    { id: "other", ts: "2026-07-20T01:00:00Z", correct: true, kind: "expression", expression: "hit the sack" },
    { id: "c1", ts: "2026-07-19T00:00:00Z", correct: true, kind: "expression", expression: "hit the sack" },
  ];
  const result = historyFor(records, item);
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((r) => r.attempt),
    [1, 2]
  );
  assert.equal(result[0].correct, true); // 07-19가 먼저
  assert.equal(result[1].correct, false);
});

test("historyFor: id 없는 옛 기록은 표현·종류로 대신 매칭한다", () => {
  const records = [{ ts: "2026-07-01T00:00:00Z", correct: true, kind: "expression", expression: "hit the sack" }];
  const result = historyFor(records, item);
  assert.equal(result.length, 1);
  assert.equal(result[0].correct, true);
});

test("historyFor: 다른 카드의 기록은 섞이지 않는다", () => {
  const records = [{ id: "c2", ts: "2026-07-01T00:00:00Z", correct: true, kind: "expression", expression: "hit the sack" }];
  assert.equal(historyFor(records, item).length, 0);
});
