import test from "node:test";
import assert from "node:assert/strict";
import { buildDictation, countBlanks, gradeDictation } from "./dictation.js";

const PARAGRAPHS = [
  { type: "heading", text: "Words and Their Stories" },
  { type: "para", text: "The grass will grow thicker and greener again." },
];

test("heading 문단은 빈칸 대상에서 빠진다", () => {
  const lines = buildDictation(PARAGRAPHS, "high");
  assert.equal(lines.length, 1);
});

test("초급은 짧은 단어·불용어를 건너뛰고 긴 내용어만 빈칸으로 만든다", () => {
  const [line] = buildDictation(PARAGRAPHS, "basic");
  assert.deepEqual(
    line.blanks.map((b) => b.answer),
    ["thicker", "greener"]
  );
});

test("중급은 불용어를 뺀 모든 내용어를 빈칸으로 만든다", () => {
  const [line] = buildDictation(PARAGRAPHS, "mid");
  assert.deepEqual(
    line.blanks.map((b) => b.answer),
    ["grass", "grow", "thicker", "greener"]
  );
});

test("상급은 불용어를 포함해 문장 전체를 빈칸으로 만든다 — 같은 단어가 반복돼도 전부 잡힌다", () => {
  const [line] = buildDictation(PARAGRAPHS, "high");
  assert.deepEqual(
    line.blanks.map((b) => b.answer),
    ["The", "grass", "will", "grow", "thicker", "and", "greener", "again"]
  );
  // parts.length는 항상 blanks.length + 1 이어야 weaveHTML이 올바르게 짠다.
  assert.equal(line.parts.length, line.blanks.length + 1);
});

test("반복되는 흔한 단어(the)가 한 문장 안에 여러 번 있어도 전부 각자 빈칸이 된다", () => {
  const [line] = buildDictation([{ type: "para", text: "The cat sat on the mat by the door." }], "high");
  const theCount = line.blanks.filter((b) => b.answer.toLowerCase() === "the").length;
  assert.equal(theCount, 3);
});

test("countBlanks/gradeDictation은 정답·오답·빈칸 미입력을 모두 판정한다", () => {
  const lines = buildDictation(PARAGRAPHS, "basic");
  assert.equal(countBlanks(lines), 2);
  const results = gradeDictation(lines, [["thicker"], ["wrong"]]);
  assert.deepEqual(results, [true, false]);
  // 대소문자·앞뒤 공백은 무시한다(shared/cloze.js의 normalize 재사용).
  assert.deepEqual(gradeDictation(lines, [[" Thicker "], [""]]), [true, false]);
});
