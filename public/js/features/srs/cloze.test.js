import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuiz, grade, normalize } from "./cloze.js";

test("buildQuiz: 예문에 표현이 있으면 빈칸을 뚫는다", () => {
  const q = buildQuiz({
    expression: "hit the sack",
    meaning: "자다",
    example: "I'm tired, so I'll hit the sack early.",
  });
  assert.equal(q.type, "cloze");
  assert.equal(q.prompt, "I'm tired, so I'll ____ early.");
  assert.equal(q.answer, "hit the sack");
  assert.equal(q.hint, "자다");
});

test("buildQuiz: 대소문자가 달라도 찾고, 예문 표기를 정답으로 쓴다", () => {
  const q = buildQuiz({
    expression: "on the fence",
    meaning: "결정을 못 내린",
    example: "On the fence about the offer, she asked for time.",
  });
  assert.equal(q.type, "cloze");
  assert.equal(q.prompt, "____ about the offer, she asked for time.");
  assert.equal(q.answer, "On the fence");
});

test("buildQuiz: 예문에 표현이 없으면 뜻→표현 문제로 폴백", () => {
  const q = buildQuiz({
    expression: "call it a day",
    meaning: "그만하기로 하다",
    example: "We decided to stop working.",
  });
  assert.equal(q.type, "recall");
  assert.equal(q.prompt, "그만하기로 하다");
  assert.equal(q.answer, "call it a day");
});

test("normalize: 대소문자/공백/양끝 구두점을 무시한다", () => {
  assert.equal(normalize("  Hit  the Sack. "), "hit the sack");
  assert.equal(normalize('"On the fence,"'), "on the fence");
});

test("grade: 정규화 후 일치하면 정답", () => {
  assert.equal(grade("hit the sack", "Hit the sack"), true);
  assert.equal(grade(" hit the  sack. ", "hit the sack"), true);
  assert.equal(grade("hit a sack", "hit the sack"), false);
  assert.equal(grade("", "hit the sack"), false);
});
