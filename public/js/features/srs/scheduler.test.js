import { test } from "node:test";
import assert from "node:assert/strict";
import { review, clearLeech, fuzzInterval, masteryLabel, INTERVALS, LAPSE_DROP, LEECH_THRESHOLD } from "./scheduler.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-17T12:00:00Z");
const noFuzz = () => 0.5; // fuzzInterval에서 offset 0이 되는 rand (간격을 정확히 검증할 때)

function card(overrides = {}) {
  return {
    id: "c1",
    expression: "hit the sack",
    meaning: "자다",
    example: "I'll hit the sack.",
    source: "expression",
    addedAt: NOW,
    reps: 0,
    lapses: 0,
    streak: 0,
    interval: 0,
    due: NOW,
    ...overrides,
  };
}

test("review 정답: 간격 사다리를 한 칸씩 오른다", () => {
  let c = card();
  for (let i = 0; i < INTERVALS.length; i++) {
    c = review(c, true, NOW, noFuzz);
    assert.equal(c.streak, i + 1);
    assert.equal(c.interval, INTERVALS[i]);
    assert.equal(c.due, NOW + INTERVALS[i] * DAY);
  }
});

test("review 정답: 사다리 끝에서는 최대 간격을 유지한다", () => {
  const top = card({ streak: INTERVALS.length + 3 });
  const after = review(top, true, NOW, noFuzz);
  assert.equal(after.interval, INTERVALS[INTERVALS.length - 1]);
});

test("review 오답: 사다리를 4칸 내려간다 (완전 리셋이 아니다)", () => {
  // streak 7(120일) → 3 → INTERVALS[2] = 7일
  const mature = card({ streak: 7, interval: 120, due: NOW + 120 * DAY });
  const after = review(mature, false, NOW, noFuzz);
  assert.equal(after.streak, 7 - LAPSE_DROP);
  assert.equal(after.interval, 7);
  assert.equal(after.due, NOW + 7 * DAY);
});

test("review 오답: 사다리 바닥 아래로는 내려가지 않고 다음 날 다시", () => {
  const young = card({ streak: 2, interval: 3, due: NOW + 3 * DAY });
  const after = review(young, false, NOW, noFuzz);
  assert.equal(after.streak, 0);
  assert.equal(after.interval, 1);
  assert.equal(after.due, NOW + DAY);
});

test("review: 오답마다 lapses가 쌓이고 8회에서 leech가 된다", () => {
  let c = card({ lapses: LEECH_THRESHOLD - 2 });
  c = review(c, false, NOW, noFuzz);
  assert.equal(c.lapses, LEECH_THRESHOLD - 1);
  assert.equal(c.leech, false);

  c = review(c, false, NOW, noFuzz);
  assert.equal(c.lapses, LEECH_THRESHOLD);
  assert.equal(c.leech, true);
});

test("review 정답: lapses를 건드리지 않는다", () => {
  const c = review(card({ lapses: 3 }), true, NOW, noFuzz);
  assert.equal(c.lapses, 3);
  assert.equal(c.leech, undefined);
});

test("review: reps가 매번 늘고, reps/lapses가 없는 옛 카드도 처리한다", () => {
  const legacy = { id: "old", streak: 2, interval: 3, due: NOW }; // reps·lapses 없음
  const ok = review(legacy, true, NOW, noFuzz);
  assert.equal(ok.reps, 1);
  assert.equal(ok.streak, 3);

  const failed = review(legacy, false, NOW, noFuzz);
  assert.equal(failed.reps, 1);
  assert.equal(failed.lapses, 1);
  assert.equal(failed.streak, 0);
});

test("review: 원본 카드를 바꾸지 않는다", () => {
  const c = card();
  review(c, true, NOW);
  assert.equal(c.streak, 0);
  assert.equal(c.interval, 0);
  assert.equal(c.reps, 0);
});

test("clearLeech: 누적 실패를 지워 다시 8회 뒤에 묻게 한다", () => {
  const leeched = card({ lapses: LEECH_THRESHOLD, leech: true, streak: 1 });
  const after = clearLeech(leeched);
  assert.equal(after.lapses, 0);
  assert.equal(after.leech, false);
  assert.equal(after.streak, 1); // 간격은 건드리지 않는다
  assert.equal(leeched.lapses, LEECH_THRESHOLD); // 원본 불변
});

test("fuzzInterval: 3일 미만은 흔들지 않는다", () => {
  assert.equal(fuzzInterval(1, () => 0), 1);
  assert.equal(fuzzInterval(1, () => 1), 1);
  assert.equal(fuzzInterval(2, () => 0), 2);
});

test("fuzzInterval: 30일은 ±15%(±5일) 범위에서 흔들린다", () => {
  assert.equal(fuzzInterval(30, () => 0), 25); // 최소
  assert.equal(fuzzInterval(30, () => 0.5), 30); // 중앙
  assert.equal(fuzzInterval(30, () => 1), 35); // 최대
});

test("fuzzInterval: 어떤 rand에도 1일 이상을 보장한다", () => {
  for (const days of [3, 7, 14, 30, 60, 120]) {
    for (const r of [0, 0.25, 0.5, 0.75, 1]) {
      assert.ok(fuzzInterval(days, () => r) >= 1);
    }
  }
});

test("review: 같은 날 담은 카드들의 due가 흩어진다", () => {
  // 같은 상태의 카드 두 장에 서로 다른 rand를 주면 due가 달라진다(복습 몰림 방지).
  const a = review(card({ streak: 4 }), true, NOW, () => 0);
  const b = review(card({ streak: 4 }), true, NOW, () => 1);
  assert.notEqual(a.due, b.due);
});

test("masteryLabel: streak에 따라 숙련도를 매긴다", () => {
  assert.equal(masteryLabel(card({ streak: 0 })), "갓 배운");
  assert.equal(masteryLabel(card({ streak: 2 })), "아직 서툰");
  assert.equal(masteryLabel(card({ streak: 4 })), "숙달된");
  assert.equal(masteryLabel(card({ streak: 5 })), "매우 숙달된");
  assert.equal(masteryLabel({ id: "no-streak" }), "갓 배운");
});
