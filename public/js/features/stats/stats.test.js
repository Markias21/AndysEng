import { test } from "node:test";
import assert from "node:assert/strict";
import { avgLastN, summarize, dailyStats, streak, toSeoulDate, calendarMonth } from "./stats.js";

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

test("dailyStats: 기능별 평균 점수를 따로 집계한다", () => {
  const ts = "2026-07-15T03:00:00Z";
  const records = {
    conversation: [
      { ts, score: 80, sentence: "a" },
      { ts, score: 100, sentence: "b" },
    ],
    writing: [{ ts, score: 60, question: "q", answer: "a" }],
    expression: [{ ts, score: 90, expression: "e", sentence: "s" }],
  };
  const [d] = dailyStats(records);
  assert.equal(d.convAvg, 90); // (80+100)/2
  assert.equal(d.writeAvg, 60);
  assert.equal(d.exprAvg, 90);
  assert.equal(d.avgScore, 82.5); // 전체 평균
});

test("calendarMonth: 격자 구조와 빈칸/날짜 셀", () => {
  const daily = dailyStats({
    conversation: [{ ts: "2026-07-15T03:00:00Z", score: 90, sentence: "a" }],
  });
  const cal = calendarMonth(daily, 2026, 7);
  assert.equal(cal.year, 2026);
  assert.equal(cal.month, 7);
  // 모든 주는 7칸
  for (const week of cal.weeks) assert.equal(week.length, 7);
  // 날짜 셀(비어있지 않은 칸) 개수 = 7월 일수(31)
  const dayCells = cal.weeks.flat().filter((c) => c.date);
  assert.equal(dayCells.length, 31);
  // 학습한 날 셀에 기능별 평균이 담긴다
  const d15 = cal.weeks.flat().find((c) => c.date === "2026-07-15");
  assert.equal(d15.day, 15);
  assert.equal(d15.convAvg, 90);
  assert.equal(d15.avgScore, 90);
  assert.equal(d15.hasStudy, true);
  // 학습 안 한 날
  const d16 = cal.weeks.flat().find((c) => c.date === "2026-07-16");
  assert.equal(d16.hasStudy, false);
  assert.equal(d16.avgScore, null);
});

test("calendarMonth: 첫 주 앞 빈칸 수 = 1일의 요일", () => {
  const cal = calendarMonth([], 2026, 7);
  const firstWeekday = new Date(2026, 6, 1).getDay();
  const leadingBlanks = cal.weeks[0].filter((c) => !c.date).length;
  assert.equal(leadingBlanks, firstWeekday);
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
