import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCloze, countBlanks, checkBlank, normalize } from "./cloze.js";

function expr(expression, overrides = {}) {
  return { expression, meaning: "뜻", example: "example", level: "B1", ...overrides };
}

function line(sentence, translation = "해석") {
  return { sentence, translation };
}

test("buildCloze: 표현을 찾아 parts/blanks로 나눈다", () => {
  const lines = buildCloze(
    [line("Many students underestimate the cost of living abroad.")],
    [expr("underestimate")]
  );

  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].parts, ["Many students ", " the cost of living abroad."]);
  assert.deepEqual(lines[0].blanks, [{ answer: "underestimate", exprIndex: 0 }]);
  assert.equal(lines[0].parts.length, lines[0].blanks.length + 1);
  assert.equal(lines[0].translation, "해석");
});

test("buildCloze: [[ ]] 마커를 걷어낸 뒤 매칭한다", () => {
  const lines = buildCloze([line("Many students [[underestimate]] the cost.")], [expr("underestimate")]);

  assert.deepEqual(lines[0].parts, ["Many students ", " the cost."]);
  assert.deepEqual(lines[0].blanks, [{ answer: "underestimate", exprIndex: 0 }]);
});

test("buildCloze: 대소문자가 달라도 매칭하고 정답은 원문 표기를 유지한다", () => {
  const lines = buildCloze([line("In the long run, it pays off.")], [expr("in the long run")]);

  assert.deepEqual(lines[0].blanks, [{ answer: "In the long run", exprIndex: 0 }]);
});

test("buildCloze: 모범 답안에 없는 표현은 빈칸이 되지 않는다", () => {
  const lines = buildCloze([line("I agree with this view.")], [expr("shed light on"), expr("agree with")]);

  assert.deepEqual(lines[0].blanks, [{ answer: "agree with", exprIndex: 1 }]);
});

test("buildCloze: 표현이 하나도 없으면 원문 한 조각만 남는다", () => {
  const lines = buildCloze([line("I agree with this view.")], [expr("shed light on")]);

  assert.deepEqual(lines[0].parts, ["I agree with this view."]);
  assert.deepEqual(lines[0].blanks, []);
});

test("buildCloze: 같은 표현이 여러 문장에 나와도 한 번만 빈칸이 된다", () => {
  const lines = buildCloze(
    [line("It pays off in the long run."), line("Saving money also pays off.")],
    [expr("pays off")]
  );

  assert.equal(lines[0].blanks.length, 1);
  assert.deepEqual(lines[1].blanks, []);
  assert.deepEqual(lines[1].parts, ["Saving money also pays off."]);
});

test("buildCloze: 단어 경계를 지킨다 (in이 interesting 안에서 잡히지 않는다)", () => {
  const lines = buildCloze([line("This is an interesting point in itself.")], [expr("in")]);

  assert.deepEqual(lines[0].blanks, [{ answer: "in", exprIndex: 0 }]);
  assert.deepEqual(lines[0].parts, ["This is an interesting point ", " itself."]);
});

test("buildCloze: 겹치는 두 표현 중 먼저 온 것만 빈칸이 된다", () => {
  const lines = buildCloze([line("It plays a crucial role here.")], [expr("plays a crucial role"), expr("crucial role")]);

  assert.deepEqual(lines[0].blanks, [{ answer: "plays a crucial role", exprIndex: 0 }]);
});

test("buildCloze: 여러 빈칸이 위치 순서대로 정렬된다", () => {
  const lines = buildCloze(
    [line("In the long run, hard work pays off.")],
    [expr("pays off"), expr("in the long run")]
  );

  assert.deepEqual(
    lines[0].blanks.map((b) => b.answer),
    ["In the long run", "pays off"]
  );
  assert.deepEqual(lines[0].parts, ["", ", hard work ", "."]);
});

test("buildCloze: 구버전 문자열 답안도 받아들인다", () => {
  const lines = buildCloze(["Hard work pays off."], [expr("pays off")]);

  assert.equal(lines[0].translation, "");
  assert.deepEqual(lines[0].blanks, [{ answer: "pays off", exprIndex: 0 }]);
});

test("countBlanks: 전체 빈칸 개수를 센다", () => {
  const lines = buildCloze(
    [line("In the long run, it pays off."), line("Nothing to fill here.")],
    [expr("in the long run"), expr("pays off")]
  );

  assert.equal(countBlanks(lines), 2);
  assert.equal(countBlanks([]), 0);
});

test("checkBlank: 대소문자·양끝 구두점·연속 공백을 무시하고 판정한다", () => {
  assert.equal(checkBlank("Pays Off", "pays off"), true);
  assert.equal(checkBlank("  pays   off.  ", "pays off"), true);
  assert.equal(checkBlank("pays of", "pays off"), false);
  assert.equal(checkBlank("", "pays off"), false);
  assert.equal(checkBlank("   ", "pays off"), false);
});

test("normalize: 양끝 구두점만 떼고 표현 안쪽 기호는 남긴다", () => {
  assert.equal(normalize("  Make up one's MIND!  "), "make up one's mind");
});
