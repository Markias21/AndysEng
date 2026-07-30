import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSession, todaysCounts, countDue } from "./session.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-17T12:00:00Z");
const LIMITS = { now: NOW, newLimit: 5, reviewLimit: 20 };

/** 복습 화면이 넘겨주는 모양({kind, raw})으로 항목을 만든다. */
function item(kind, raw) {
  return { kind, raw: { id: raw.id || "x", addedAt: NOW, due: NOW, interval: 1, ...raw } };
}

/** 한 번 이상 복습한 카드(reps > 0)는 신규가 아니다. */
function seen(id, raw = {}) {
  return item("expression", { id, reps: 3, ...raw });
}

function fresh(id, raw = {}) {
  return item("expression", { id, reps: 0, interval: 0, ...raw });
}

function many(n, make) {
  return Array.from({ length: n }, (_, i) => make(`c${i}`, i));
}

test("buildSession: 하루 총량 상한을 넘기지 않는다", () => {
  const items = many(50, (id) => seen(id));
  assert.equal(buildSession(items, LIMITS).length, 20);
});

test("buildSession: due가 아직 안 된 항목은 넣지 않는다", () => {
  const items = [seen("a", { due: NOW - DAY }), seen("b", { due: NOW + DAY }), seen("c", { due: NOW })];
  assert.deepEqual(
    buildSession(items, LIMITS).map((it) => it.raw.id),
    ["a", "c"]
  );
});

test("buildSession: 복습이 신규보다 먼저 자리를 차지한다", () => {
  const items = [...many(20, (id) => seen(id)), ...many(10, (id) => fresh(`n${id}`))];
  const queue = buildSession(items, LIMITS);
  assert.equal(queue.length, 20);
  assert.ok(queue.every((it) => it.raw.reps > 0));
});

test("buildSession: 복습이 총량을 다 못 채우면 남는 자리에만 신규를 들인다", () => {
  const items = [...many(18, (id) => seen(id)), ...many(10, (id) => fresh(`n${id}`))];
  const queue = buildSession(items, LIMITS);
  assert.equal(queue.length, 20);
  assert.equal(queue.filter((it) => !it.raw.reps).length, 2); // 남은 자리 2개만
});

test("buildSession: 신규는 총량이 남아도 신규 상한까지만", () => {
  const items = many(30, (id) => fresh(id));
  const queue = buildSession(items, LIMITS);
  assert.equal(queue.length, 5); // reviewLimit 20이 남아 있어도 newLimit 5
});

test("buildSession: 신규는 담은 순서(FIFO)로 나온다", () => {
  const items = [
    fresh("late", { addedAt: NOW - DAY }),
    fresh("oldest", { addedAt: NOW - 10 * DAY }),
    fresh("middle", { addedAt: NOW - 5 * DAY }),
  ];
  assert.deepEqual(
    buildSession(items, { ...LIMITS, newLimit: 2 }).map((it) => it.raw.id),
    ["oldest", "middle"]
  );
});

test("buildSession: 상대 연체도가 큰(잊을 위험이 큰) 복습이 앞에 온다", () => {
  // 1일 간격이 5일 밀림(5.0) > 7일 간격이 14일 밀림(2.0) > 120일 간격이 5일 밀림(0.04)
  const items = [
    seen("mature", { interval: 120, due: NOW - 5 * DAY }),
    seen("short", { interval: 1, due: NOW - 5 * DAY }),
    seen("mid", { interval: 7, due: NOW - 14 * DAY }),
  ];
  assert.deepEqual(
    buildSession(items, LIMITS).map((it) => it.raw.id),
    ["short", "mid", "mature"]
  );
});

test("buildSession: 표현과 단어를 고르게 번갈아 배치한다", () => {
  const items = [
    item("expression", { id: "e1", reps: 1 }),
    item("expression", { id: "e2", reps: 1 }),
    item("expression", { id: "e3", reps: 1 }),
    item("expression", { id: "e4", reps: 1 }),
    item("word", { id: "w1", reps: 1 }),
    item("word", { id: "w2", reps: 1 }),
  ];
  assert.deepEqual(
    buildSession(items, LIMITS).map((it) => it.raw.id),
    ["e1", "e2", "w1", "e3", "e4", "w2"]
  );
});

test("buildSession: 한 종류만 있어도 그대로 나온다", () => {
  const onlyWords = many(3, (id) => item("word", { id, reps: 1 }));
  assert.equal(buildSession(onlyWords, LIMITS).length, 3);
});

test("buildSession: 상한을 걸어도 상한 안이 한 종류로만 채워지지 않는다", () => {
  // 표현 30 + 단어 30이 모두 due인데 상한이 20이면 절반씩 나와야 한다.
  // (자르고 나서 섞으면 앞쪽 종류 20장만 담겨 단어가 영원히 안 나온다.)
  const items = [...many(30, (id) => item("expression", { id: `e${id}`, reps: 1 })), ...many(30, (id) => item("word", { id: `w${id}`, reps: 1 }))];
  const queue = buildSession(items, LIMITS);
  assert.equal(queue.length, 20);
  assert.equal(queue.filter((it) => it.kind === "word").length, 10);
  assert.equal(queue.filter((it) => it.kind === "expression").length, 10);
});

test("buildSession: 오래 방치된 단어는 표현보다 앞에 온다", () => {
  // 종류가 아니라 상대 연체도로 줄 세우므로, 밀린 단어가 표현 더미에 묻히지 않는다.
  const items = [...many(30, (id) => seen(`e${id}`, { interval: 30, due: NOW - DAY })), item("word", { id: "w1", reps: 2, interval: 1, due: NOW - 30 * DAY })];
  assert.equal(buildSession(items, LIMITS)[0].raw.id, "w1");
});

test("buildSession: 오늘 몫을 이미 다 했으면 빈 큐", () => {
  const items = many(50, (id) => seen(id));
  assert.deepEqual(buildSession(items, { ...LIMITS, totalDone: 20 }), []);
});

test("buildSession: 오늘 한 만큼만 총량에서 빠진다", () => {
  const items = many(50, (id) => seen(id));
  assert.equal(buildSession(items, { ...LIMITS, totalDone: 12 }).length, 8);
});

test("buildSession: 신규 상한을 다 쓴 날에도 복습은 계속된다", () => {
  const items = [...many(3, (id) => seen(id)), ...many(10, (id) => fresh(`n${id}`))];
  const queue = buildSession(items, { ...LIMITS, newDone: 5, totalDone: 5 });
  assert.equal(queue.length, 3);
  assert.ok(queue.every((it) => it.raw.reps > 0));
});

test("todaysCounts: 오늘 기록만 세고 신규를 따로 센다", () => {
  const records = [
    { ts: "2026-07-16T10:00:00Z", isNew: true }, // 서울 7/16
    { ts: "2026-07-17T01:00:00Z", isNew: true }, // 서울 7/17
    { ts: "2026-07-17T02:00:00Z", isNew: false },
    { ts: "2026-07-17T03:00:00Z" }, // isNew 없는 옛 기록 → 복습으로
  ];
  assert.deepEqual(todaysCounts(records, "2026-07-17"), { totalDone: 3, newDone: 1 });
});

test("todaysCounts: 하루 경계는 서울 기준", () => {
  // UTC 7/16 16:00 = 서울 7/17 01:00
  const records = [{ ts: "2026-07-16T16:00:00Z", isNew: true }];
  assert.deepEqual(todaysCounts(records, "2026-07-17"), { totalDone: 1, newDone: 1 });
  assert.deepEqual(todaysCounts(records, "2026-07-16"), { totalDone: 0, newDone: 0 });
});

test("countDue: 상한과 무관하게 지금 due인 전체를 센다", () => {
  const items = [...many(30, (id) => seen(id)), seen("later", { due: NOW + DAY })];
  assert.equal(countDue(items, NOW), 30);
});
