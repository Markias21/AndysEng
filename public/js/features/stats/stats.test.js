import { test } from "node:test";
import assert from "node:assert/strict";
import { avgLastN, summarize, dailyStats, streak, toSeoulDate } from "./stats.js";

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
  assert.equal(s.avg10, 32.5);
  assert.equal(s.avg100, 27.5);
});

test("summarize: 빈 기록", () => {
  const s = summarize([]);
  assert.deepEqual(s, { count: 0, avg10: null, avg100: null, recentScores: [] });
});

test("toSeoulDate: UTC 자정 직전은 서울에서 다음 날", () => {
  // UTC 2026-07-16 16:00 = 서울 2026-07-17 01:00
  assert.equal(toSeoulDate("2026-07-16T16:00:00Z"), "2026-07-17");
  assert.equal(toSeoulDate("2026-07-16T10:00:00Z"), "2026-07-16");
});

test("dailyStats: 날짜별로 주제/발화/작문/점수를 집계한다", () => {
  const day1 = "2026-07-15T03:00:00Z"; // 서울 07-15 낮
  const day2 = "2026-07-16T03:00:00Z";
  const records = {
    sessions: [{ ts: day1, feature: "conversation" }],
    conversation: [
      { ts: day1, score: 80, sentence: "a" },
      { ts: day1, score: 90, sentence: "b" },
    ],
    writing: [{ ts: day2, score: 70, question: "q", answer: "a" }],
    expression: [{ ts: day2, score: 90, expression: "e", sentence: "s" }],
    quiz: [
      { ts: day2, expression: "e", correct: true },
      { ts: day2, expression: "f", correct: false },
    ],
  };
  const daily = dailyStats(records);
  assert.equal(daily.length, 2);

  const [d1, d2] = daily;
  assert.equal(d1.date, "2026-07-15");
  assert.equal(d1.topics, 1); // 회화 세션 1
  assert.equal(d1.spoken, 2);
  assert.equal(d1.written, 0);
  assert.equal(d1.avgScore, 85);

  assert.equal(d2.date, "2026-07-16");
  assert.equal(d2.topics, 2); // 글쓰기 1 + 표현 1
  assert.equal(d2.spoken, 0);
  assert.equal(d2.written, 2);
  assert.equal(d2.avgScore, 80);
  assert.equal(d2.quizCount, 2);
  assert.equal(d2.quizCorrect, 1);
});

test("dailyStats: 빈 기록이면 빈 배열", () => {
  assert.deepEqual(dailyStats({}), []);
});

test("streak: 오늘 포함 연속 일수를 센다", () => {
  const dates = ["2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17"];
  assert.equal(streak(dates, "2026-07-17"), 4);
});

test("streak: 오늘 기록이 없으면 어제까지 연속을 센다", () => {
  const dates = ["2026-07-15", "2026-07-16"];
  assert.equal(streak(dates, "2026-07-17"), 2);
});

test("streak: 중간이 끊기면 거기서 멈춘다", () => {
  const dates = ["2026-07-12", "2026-07-14", "2026-07-15"];
  assert.equal(streak(dates, "2026-07-15"), 2);
});

test("streak: 기록이 없으면 0", () => {
  assert.equal(streak([], "2026-07-17"), 0);
});
