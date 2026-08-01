import { test } from "node:test";
import assert from "node:assert/strict";
import { DIFFICULTIES, blankCount, blanksFor, findDifficulty } from "./difficulty.js";

const essay = {
  blanks: [
    { expression: "In my opinion", meaning: "제 생각에는", level: 1 },
    { expression: "plays a crucial role", meaning: "결정적인 역할을 하다", level: 2 },
    { expression: "In conclusion", meaning: "결론적으로", level: 1 },
    { expression: "at the expense of", meaning: "~을 희생하고", level: 3 },
  ],
};

test("blanksFor: 고른 난이도 이하의 빈칸만 남긴다", () => {
  assert.deepEqual(
    blanksFor(essay, "basic").map((b) => b.expression),
    ["In my opinion", "In conclusion"]
  );
  assert.equal(blankCount(essay, "mid"), 3);
  assert.equal(blankCount(essay, "high"), 4);
});

test("blanksFor: 본문 등장 순서를 유지한다", () => {
  assert.deepEqual(
    blanksFor(essay, "high").map((b) => b.expression),
    essay.blanks.map((b) => b.expression)
  );
});

test("blanksFor: 상급은 중급을, 중급은 초급을 모두 포함한다", () => {
  const basic = blanksFor(essay, "basic");
  const mid = blanksFor(essay, "mid");
  const high = blanksFor(essay, "high");
  assert.ok(basic.every((b) => mid.includes(b)));
  assert.ok(mid.every((b) => high.includes(b)));
});

test("blanksFor: 모르는 난이도는 기본 난이도(중급)로 본다", () => {
  assert.equal(blankCount(essay, "nope"), blankCount(essay, "mid"));
});

test("blanksFor: 빈칸이 없는 지문도 빈 배열을 돌려준다", () => {
  assert.deepEqual(blanksFor({}, "high"), []);
  assert.deepEqual(blanksFor(null, "high"), []);
});

test("findDifficulty: 정의된 난이도는 찾고 아니면 null", () => {
  assert.equal(findDifficulty("high").maxLevel, 3);
  assert.equal(findDifficulty("nope"), null);
  assert.equal(DIFFICULTIES.length, 3);
});
