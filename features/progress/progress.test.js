import { test } from "node:test";
import assert from "node:assert/strict";
import { avgLastN, summarize } from "./progress.js";

test("avgLastN: 기록이 없으면 null", () => {
  assert.equal(avgLastN([], 10), null);
});

test("avgLastN: n개 미만이면 있는 것만으로 평균", () => {
  assert.equal(avgLastN([80, 90], 10), 85);
});

test("avgLastN: 최근 n개만 사용한다", () => {
  const scores = [0, 0, 0, 100, 100]; // 최근 2개만
  assert.equal(avgLastN(scores, 2), 100);
});

test("avgLastN: 소수점 첫째 자리로 반올림", () => {
  assert.equal(avgLastN([70, 75, 80], 3), 75);
  assert.equal(avgLastN([70, 71], 2), 70.5);
});

test("avgLastN: 잘못된 n은 에러", () => {
  assert.throws(() => avgLastN([1], 0));
  assert.throws(() => avgLastN([1], -1));
  assert.throws(() => avgLastN([1], 1.5));
});

test("summarize: 개수, 평균, 최근 점수를 반환한다", () => {
  const records = Array.from({ length: 12 }, (_, i) => ({ ts: `t${i}`, score: i * 5 }));
  const s = summarize(records);
  assert.equal(s.count, 12);
  assert.equal(s.recentScores.length, 10);
  assert.equal(s.recentScores[9], 55);
  // 최근 10개: 10,15,...,55 → 평균 32.5
  assert.equal(s.avg10, 32.5);
  // 100개 미만이므로 전체 평균: 0..55 step5 → 27.5
  assert.equal(s.avg100, 27.5);
});

test("summarize: 빈 기록", () => {
  const s = summarize([]);
  assert.deepEqual(s, { count: 0, avg10: null, avg100: null, recentScores: [] });
});
