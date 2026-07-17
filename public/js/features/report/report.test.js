import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, nextReportName } from "./report.js";

test("nextReportName: 그 날 첫 리포트는 날짜.md", () => {
  assert.equal(nextReportName("2026-07-16", []), "2026-07-16.md");
  assert.equal(nextReportName("2026-07-16", ["2026-07-15.md"]), "2026-07-16.md");
});

test("nextReportName: 2번째부터 번호를 붙인다", () => {
  assert.equal(nextReportName("2026-07-16", ["2026-07-16.md"]), "2026-07-16-2.md");
  assert.equal(
    nextReportName("2026-07-16", ["2026-07-16.md", "2026-07-16-2.md"]),
    "2026-07-16-3.md"
  );
});

test("nextReportName: 번호가 비어도 최댓값+1을 쓴다", () => {
  assert.equal(
    nextReportName("2026-07-16", ["2026-07-16.md", "2026-07-16-3.md"]),
    "2026-07-16-4.md"
  );
});

test("nextReportName: json 등 다른 파일은 무시한다", () => {
  assert.equal(
    nextReportName("2026-07-16", ["2026-07-16.json", "other.md"]),
    "2026-07-16.md"
  );
});

test("buildReport: 헤더와 총 문장 수를 담는다", () => {
  const md = buildReport(
    { conversation: [{ score: 90, sentence: "I like coffee." }] },
    { dateLabel: "2026-07-16 14:30" }
  );
  assert.match(md, /# AndysEng 학습 리포트 — 2026-07-16 14:30/);
  assert.match(md, /학습한 문장 수: 1개/);
  assert.match(md, /I like coffee\./);
});

test("buildReport: 기록이 없는 섹션은 생략한다", () => {
  const md = buildReport(
    { expression: [{ score: 80, expression: "hit the sack", sentence: "I will hit the sack." }] },
    { dateLabel: "2026-07-16 09:00" }
  );
  assert.doesNotMatch(md, /회화/);
  assert.doesNotMatch(md, /글쓰기/);
  assert.doesNotMatch(md, /복습 퀴즈/);
  assert.match(md, /💡 표현/);
  assert.match(md, /hit the sack/);
});

test("buildReport: 글쓰기 피드백을 펼쳐 담는다", () => {
  const md = buildReport(
    {
      writing: [
        {
          score: 75,
          question: "Is social media good?",
          answer: "I think yes.",
          feedback: {
            corrected_answer: "I think so.",
            native_answer: "Social media has clear upsides.",
            native_expressions: [{ expression: "clear upsides", meaning: "분명한 장점" }],
          },
        },
      ],
    },
    { dateLabel: "2026-07-16 20:00" }
  );
  assert.match(md, /Is social media good\?/);
  assert.match(md, /I think so\./);
  assert.match(md, /Social media has clear upsides\./);
  assert.match(md, /clear upsides.*분명한 장점/);
});

test("buildReport: 복습 퀴즈 결과를 정답률과 함께 담는다", () => {
  const md = buildReport(
    {
      quiz: [
        { expression: "hit the sack", correct: true },
        { expression: "on the fence", correct: false },
      ],
    },
    { dateLabel: "2026-07-17 21:00" }
  );
  assert.match(md, /🔁 복습 퀴즈 \(2문제, 정답률 50%\)/);
  assert.match(md, /✅ hit the sack/);
  assert.match(md, /❌ on the fence/);
});
