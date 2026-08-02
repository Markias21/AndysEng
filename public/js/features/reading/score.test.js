import test from "node:test";
import assert from "node:assert/strict";
import { CORRECT, SKIPPED, WRONG, comprehensionSummary, gradeBlanks, gradeChoices, weakTypes } from "./score.js";
import { bodyText, resolveBlanks, sentenceContaining, sentencesOf } from "./passage.js";

const QUESTIONS = [
  { type: "factual", answer: 2 },
  { type: "inference", answer: 0 },
  { type: "inference", answer: 3 },
  { type: "vocabulary", answer: 1 },
];

test("고르지 않은 문제는 오답이 아니라 스킵이다", () => {
  const results = gradeChoices(QUESTIONS, [2, 1, null, undefined]);
  assert.deepEqual(
    results.map((r) => r.status),
    [CORRECT, WRONG, SKIPPED, SKIPPED]
  );
  // 스킵한 문제에는 고른 답이 없다.
  assert.equal(results[2].chosen, null);
  assert.equal(results[3].chosen, null);
  // 0번을 고른 것과 안 고른 것은 구분된다(0은 유효한 선택지다).
  assert.equal(gradeChoices([{ type: "factual", answer: 1 }], [0])[0].status, WRONG);
});

test("정답률은 스킵을 뺀 푼 문제 기준이다", () => {
  const s = comprehensionSummary(gradeChoices(QUESTIONS, [2, 1, null, 1]));
  assert.deepEqual(s, { total: 4, correct: 2, wrong: 1, skipped: 1, accuracy: 67 });
});

test("전부 스킵하면 정답률은 없다(0%가 아니다)", () => {
  const s = comprehensionSummary(gradeChoices(QUESTIONS, [null, null, null, null]));
  assert.equal(s.skipped, 4);
  assert.equal(s.accuracy, null);
});

test("빈칸은 표현 전체가 맞아야 정답이고 단어별 결과도 함께 낸다", () => {
  const blanks = [{ expression: "seek out" }, { expression: "best-kept secret" }, { expression: "look at" }];
  const results = gradeBlanks(blanks, [["seek", "out"], ["best-kept", "story"], ["", ""]]);
  assert.deepEqual(
    results.map((r) => r.status),
    [CORRECT, WRONG, SKIPPED]
  );
  assert.deepEqual(results[1].wordFlags, [true, false]);
});

test("빈칸 채점은 대소문자·양끝 구두점을 무시한다", () => {
  const results = gradeBlanks([{ expression: "seek out" }], [["Seek", "out,"]]);
  assert.equal(results[0].status, CORRECT);
});

test("약점 유형은 틀린 개수 순이고 스킵은 세지 않는다", () => {
  const weak = weakTypes(gradeChoices(QUESTIONS, [0, 1, 1, null]));
  assert.deepEqual(weak, [
    { type: "inference", label: "추론", count: 2 },
    { type: "factual", label: "사실 정보", count: 1 },
  ]);
});

// ===== 지문 =====
const ARTICLE = {
  paragraphs: [
    { type: "para", text: "Dr. Dunn calls physical therapists the best-kept secret in health care. She works in the U.S. today." },
    { type: "heading", text: "Follow the example of dental care" },
    { type: "para", text: "Many people only seek out therapists after an injury." },
  ],
};

test("bodyText는 소제목을 빼고 본문만 잇는다", () => {
  assert.ok(!bodyText(ARTICLE).includes("Follow the example"));
  assert.ok(bodyText(ARTICLE).includes("best-kept secret"));
});

test("문장 분리는 약어(Dr. / U.S.) 뒤에서 끊지 않는다", () => {
  const sentences = sentencesOf(ARTICLE);
  assert.equal(sentences[0], "Dr. Dunn calls physical therapists the best-kept secret in health care.");
  assert.equal(sentences[1], "She works in the U.S. today.");
});

test("표현이 들어 있는 문장을 지문에서 되찾는다", () => {
  assert.equal(sentenceContaining(ARTICLE, "seek out"), "Many people only seek out therapists after an injury.");
  assert.equal(sentenceContaining(ARTICLE, "not in the passage"), null);
});

test("지문에서 찾지 못한 표현은 빈칸에서 버린다", () => {
  const blanks = resolveBlanks(ARTICLE, [
    { expression: "seek out", meaning: "찾아 나서다" },
    { expression: "made up", meaning: "지어내다" },
  ]);
  assert.equal(blanks.length, 1);
  assert.equal(blanks[0].expression, "seek out");
  assert.equal(blanks[0].sentence, "Many people only seek out therapists after an injury.");
});
