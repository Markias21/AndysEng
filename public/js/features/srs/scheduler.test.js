import { test } from "node:test";
import assert from "node:assert/strict";
import { review, dueCards, INTERVALS } from "./scheduler.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-17T12:00:00Z");

function card(overrides = {}) {
  return {
    id: "c1",
    expression: "hit the sack",
    meaning: "자다",
    example: "I'll hit the sack.",
    source: "expression",
    addedAt: NOW,
    streak: 0,
    interval: 0,
    due: NOW,
    ...overrides,
  };
}

test("review 정답: 간격 사다리를 한 칸씩 오른다", () => {
  let c = card();
  for (let i = 0; i < INTERVALS.length; i++) {
    c = review(c, true, NOW);
    assert.equal(c.streak, i + 1);
    assert.equal(c.interval, INTERVALS[i]);
    assert.equal(c.due, NOW + INTERVALS[i] * DAY);
  }
});

test("review 정답: 사다리 끝에서는 최대 간격을 유지한다", () => {
  const top = card({ streak: INTERVALS.length + 3 });
  const after = review(top, true, NOW);
  assert.equal(after.interval, INTERVALS[INTERVALS.length - 1]);
});

test("review 오답: 처음으로 돌아가고 10분 뒤 재도전", () => {
  const learned = card({ streak: 4, interval: 14, due: NOW + 14 * DAY });
  const after = review(learned, false, NOW);
  assert.equal(after.streak, 0);
  assert.equal(after.interval, 0);
  assert.equal(after.due, NOW + 10 * 60 * 1000);
});

test("review: 원본 카드를 바꾸지 않는다", () => {
  const c = card();
  review(c, true, NOW);
  assert.equal(c.streak, 0);
  assert.equal(c.interval, 0);
});

test("dueCards: due가 지난 카드만 오래된 순으로", () => {
  const a = card({ id: "a", due: NOW - 2 * DAY });
  const b = card({ id: "b", due: NOW + DAY });
  const c = card({ id: "c", due: NOW - DAY });
  const due = dueCards([a, b, c], NOW);
  assert.deepEqual(due.map((x) => x.id), ["a", "c"]);
});
