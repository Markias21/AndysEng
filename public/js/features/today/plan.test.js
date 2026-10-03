import { test } from "node:test";
import assert from "node:assert/strict";
import { weekRange } from "../../shared/date.js";
import { AREA_OF_RECORD, GOAL_AREAS, recommend, weekProgress } from "./plan.js";

// 2026-10-05(월) ~ 2026-10-11(일)이 한 주. 아래 테스트는 수요일(2026-10-07)을 "오늘"로 쓴다.
const THU = "2026-10-08";
const ts = (date, hourKst = 12) => `${date}T${String(hourKst - 9).padStart(2, "0")}:00:00Z`;
const GOALS = { unit: "days", R: 3, L: 3, W: 2, conversation: 3 };

test("weekRange: 서울 날짜가 속한 월~일 주를 돌려준다", () => {
  assert.deepEqual(weekRange("2026-10-05"), { start: "2026-10-05", end: "2026-10-11", dayIndex: 0 });
  assert.deepEqual(weekRange("2026-10-11"), { start: "2026-10-05", end: "2026-10-11", dayIndex: 6 });
  // 일요일 다음은 새 주다(일요일을 주의 시작으로 보지 않는다).
  assert.equal(weekRange("2026-10-12").start, "2026-10-12");
  // 월 경계를 넘어가도 주는 끊기지 않는다.
  assert.deepEqual(weekRange("2026-10-03"), { start: "2026-09-28", end: "2026-10-04", dayIndex: 5 });
});

test("AREA_OF_RECORD: 기록 종류를 영역으로 묶는다", () => {
  assert.equal(AREA_OF_RECORD.reading, "R");
  assert.equal(AREA_OF_RECORD.shortReading, "R");
  assert.equal(AREA_OF_RECORD.listening, "L");
  assert.equal(AREA_OF_RECORD.sixMin, "L");
  assert.equal(AREA_OF_RECORD.writing, "W");
  assert.equal(AREA_OF_RECORD.writingBasic, "W");
  assert.equal(AREA_OF_RECORD.quiz, "review");
  // sessions(주제 시작 이벤트)는 학습 1회가 아니므로 어느 영역에도 세지 않는다.
  assert.equal(AREA_OF_RECORD.sessions, undefined);
});

test("weekProgress(days): 같은 날 여러 번 해도 1일로 센다", () => {
  const records = {
    reading: [{ ts: ts("2026-10-06") }, { ts: ts("2026-10-06", 20) }],
    shortReading: [{ ts: ts("2026-10-06", 21) }],
  };
  const { areas } = weekProgress(records, GOALS, THU);
  const R = areas.find((a) => a.id === "R");
  assert.equal(R.done, 1, "리딩 기록 3건이 모두 같은 날이면 1일");
  assert.equal(R.goal, 3);
});

test("weekProgress(days): 영역이 다른 기록이 같은 날이면 영역별로 각각 1일", () => {
  const records = {
    reading: [{ ts: ts("2026-10-06") }],
    listening: [{ ts: ts("2026-10-06") }],
    conversation: [{ ts: ts("2026-10-06") }],
  };
  const { areas } = weekProgress(records, GOALS, THU);
  assert.deepEqual(
    areas.map((a) => [a.id, a.done]),
    [["R", 1], ["L", 1], ["W", 0], ["conversation", 1]]
  );
});

test("weekProgress(counts): 건수로 세면 같은 날 여러 번이 그대로 더해진다", () => {
  const records = { reading: [{ ts: ts("2026-10-06") }, { ts: ts("2026-10-06", 20) }, { ts: ts("2026-10-07") }] };
  const { areas, unit } = weekProgress(records, { ...GOALS, unit: "counts" }, THU);
  assert.equal(unit, "counts");
  assert.equal(areas.find((a) => a.id === "R").done, 3);
});

test("weekProgress: 이번 주 밖의 기록은 세지 않는다", () => {
  const records = {
    reading: [
      { ts: ts("2026-10-04") }, // 지난 주 일요일
      { ts: ts("2026-10-06") }, // 이번 주
      { ts: ts("2026-10-12") }, // 다음 주 월요일
    ],
  };
  const { areas, weekStart, weekEnd, daysLeft } = weekProgress(records, GOALS, THU);
  assert.equal(areas.find((a) => a.id === "R").done, 1);
  assert.equal(weekStart, "2026-10-05");
  assert.equal(weekEnd, "2026-10-11");
  assert.equal(daysLeft, 4, "목요일이면 목·금·토·일 4일 남는다");
});

test("weekProgress: 하루 경계는 서울 기준이다", () => {
  // 2026-10-11T15:30:00Z = 서울 2026-10-12 00:30 → 이번 주(일요일까지)가 아니라 다음 주다.
  const records = { reading: [{ ts: "2026-10-11T15:30:00Z" }] };
  assert.equal(weekProgress(records, GOALS, THU).areas.find((a) => a.id === "R").done, 0);
  // 같은 날 UTC 14:00은 서울 23:00 → 이번 주 안이다.
  const inside = { reading: [{ ts: "2026-10-11T14:00:00Z" }] };
  assert.equal(weekProgress(inside, GOALS, THU).areas.find((a) => a.id === "R").done, 1);
});

test("weekProgress: 빈 기록·목표 없음에도 터지지 않는다", () => {
  const empty = weekProgress({}, {}, THU);
  assert.equal(empty.areas.length, GOAL_AREAS.length);
  assert.deepEqual(empty.areas.map((a) => a.goal), [0, 0, 0, 0]);
  // 목표가 0이면 "달성할 것이 없음"이라 ratio는 1로 본다(0 나누기 방지).
  assert.deepEqual(empty.areas.map((a) => a.ratio), [1, 1, 1, 1]);
  assert.equal(weekProgress(undefined, undefined, THU).areas[0].done, 0);
  assert.equal(weekProgress({ reading: [{}, null] }, GOALS, THU).areas[0].done, 0, "ts 없는 기록은 건너뛴다");
});

test("recommend: 복습 대기가 있으면 항상 첫 줄", () => {
  const progress = weekProgress({}, GOALS, THU);
  const out = recommend(progress, 12);
  assert.equal(out[0].kind, "review");
  assert.equal(out[0].note, "12개 대기");
  assert.deepEqual(out[0].target, { view: "srs" });
  assert.equal(out.length, 3, "복습 1개 + 뒤처진 영역 2개");
});

test("recommend: 진행률이 낮은 영역 순, 동률은 고정 순서", () => {
  // R은 2/3(0.67), L은 0/3(0), W는 0/2(0), conversation은 3/3(1.0 — 추천에서 빠진다)
  const records = {
    reading: [{ ts: ts("2026-10-05") }, { ts: ts("2026-10-06") }],
    conversation: [{ ts: ts("2026-10-05") }, { ts: ts("2026-10-06") }, { ts: ts("2026-10-07") }],
  };
  const out = recommend(weekProgress(records, GOALS, THU), 0);
  assert.deepEqual(out.map((o) => o.id), ["L", "W", "R"], "0인 L·W가 먼저, 동률 L/W는 고정 순서");
  assert.equal(out.find((o) => o.id === "R").note, "1일 더");
});

test("recommend: 목표를 다 채우면 추천이 비고, 단위에 맞는 문구를 쓴다", () => {
  const done = { unit: "days", R: 1, L: 1, W: 1, conversation: 1 };
  const records = {
    reading: [{ ts: ts("2026-10-05") }],
    listening: [{ ts: ts("2026-10-05") }],
    writing: [{ ts: ts("2026-10-05") }],
    conversation: [{ ts: ts("2026-10-05") }],
  };
  assert.deepEqual(recommend(weekProgress(records, done, THU), 0), []);
  const counts = recommend(weekProgress({}, { ...GOALS, unit: "counts" }, THU), 0);
  assert.equal(counts[0].note, "3회 더");
});
