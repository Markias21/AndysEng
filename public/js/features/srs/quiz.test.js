import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuiz, variantsOf } from "./quiz.js";

function card(over = {}) {
  return { term: "pay off", meaning: "성과를 내다", example: "Hard work pays off.", exampleKo: "노력은 성과를 낸다.", ...over };
}

test("buildQuiz: 예문에서 표현을 찾아 빈칸으로 만든다", () => {
  const quiz = buildQuiz(card({ term: "pays off" }));

  assert.equal(quiz.mode, "example");
  assert.deepEqual(quiz.parts, ["Hard work ", "."]);
  assert.equal(quiz.answer, "pays off");
  assert.equal(quiz.translation, "노력은 성과를 낸다.");
});

test("buildQuiz: 예문에 활용형으로 있어도 찾고, 정답은 예문 표기를 따른다", () => {
  assert.equal(buildQuiz(card()).answer, "pays off");
  assert.equal(buildQuiz(card({ term: "study", example: "She studies every night." })).answer, "studies");
  assert.equal(buildQuiz(card({ term: "stop", example: "He stopped smoking." })).answer, "stopped");
  assert.equal(buildQuiz(card({ term: "make up", example: "They are making up stories." })).answer, "making up");
});

test("buildQuiz: 대소문자가 달라도 찾는다", () => {
  const quiz = buildQuiz(card({ term: "in the long run", example: "In the long run, it works." }));

  assert.equal(quiz.answer, "In the long run");
  assert.deepEqual(quiz.parts, ["", ", it works."]);
});

test("buildQuiz: 예문에서 표현을 못 찾으면 뜻 보고 표현 쓰기로 떨어진다", () => {
  const quiz = buildQuiz(card({ term: "shed light on" }));

  assert.equal(quiz.mode, "term");
  assert.equal(quiz.answer, "shed light on");
});

test("buildQuiz: 예문이 없으면 뜻 보고 표현 쓰기", () => {
  assert.deepEqual(buildQuiz(card({ example: "" })), { mode: "term", answer: "pay off" });
  assert.deepEqual(buildQuiz({ term: "grit", meaning: "투지" }), { mode: "term", answer: "grit" });
});

test("buildQuiz: 예문 해석이 없는 옛 카드도 예문 빈칸으로 낸다", () => {
  const quiz = buildQuiz(card({ exampleKo: undefined }));

  assert.equal(quiz.mode, "example");
  assert.equal(quiz.translation, "");
});

test("buildQuiz: 단어 경계를 지킨다 (in이 interesting 안에서 잡히지 않는다)", () => {
  const quiz = buildQuiz(card({ term: "in", example: "This is an interesting point in itself." }));

  assert.deepEqual(quiz.parts, ["This is an interesting point ", " itself."]);
});

test("variantsOf: 원형을 먼저 시도하고 첫 단어·마지막 단어를 굴절시킨다", () => {
  const forms = variantsOf("pay off");

  assert.equal(forms[0], "pay off");
  assert.ok(forms.includes("pays off"));
  assert.ok(forms.includes("pay offs"));
  assert.deepEqual(variantsOf(""), []);
});
