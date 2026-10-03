import { test } from "node:test";
import assert from "node:assert/strict";
import { extractGaps } from "./gaps.js";

test("extractGaps: 한글이 든 괄호만 막힌 곳으로 본다", () => {
  const text = "Social media (~에 큰 영향을 미치다) young people's self-esteem.";
  assert.deepEqual(extractGaps(text), [{ ko: "~에 큰 영향을 미치다", index: text.indexOf("(") }]);
});

test("extractGaps: 영어만 든 괄호는 일반 괄호로 두고 건드리지 않는다", () => {
  const text = "Many studies (for example, Smith 2020) support this (한국어 표시) point.";
  assert.deepEqual(extractGaps(text).map((g) => g.ko), ["한국어 표시"]);
});

test("extractGaps: 전각 괄호도 받는다", () => {
  assert.deepEqual(extractGaps("I want to （극복하다） my fear.").map((g) => g.ko), ["극복하다"]);
  // 여는 괄호는 반각, 닫는 괄호는 전각인 섞인 경우(모바일 입력에서 흔하다)도 받는다.
  assert.deepEqual(extractGaps("I want to (극복하다） my fear.").map((g) => g.ko), ["극복하다"]);
});

test("extractGaps: 빈 괄호와 공백뿐인 괄호는 건너뛴다", () => {
  const text = "a () b (   ) c (진짜) d";
  assert.deepEqual(extractGaps(text), [{ ko: "진짜", index: text.indexOf("(진짜)") }]);
});

test("extractGaps: 여러 개를 글에 나온 순서대로 돌려준다", () => {
  const text = "First (처음), then (그 다음), finally (마지막).";
  assert.deepEqual(extractGaps(text).map((g) => g.ko), ["처음", "그 다음", "마지막"]);
  const idx = extractGaps(text).map((g) => g.index);
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, "index가 오름차순이다");
});

test("extractGaps: 중첩 괄호는 가장 안쪽만 잡는다", () => {
  assert.deepEqual(extractGaps("outer ((안쪽만)) tail").map((g) => g.ko), ["안쪽만"]);
});

test("extractGaps: 자모만 있어도 한글로 본다", () => {
  assert.deepEqual(extractGaps("hmm (ㅋㅋ) ok").map((g) => g.ko), ["ㅋㅋ"]);
});

test("extractGaps: 빈 입력·null에도 터지지 않는다", () => {
  assert.deepEqual(extractGaps(""), []);
  assert.deepEqual(extractGaps(null), []);
  assert.deepEqual(extractGaps(undefined), []);
});

test("extractGaps: 여러 번 불러도 같은 결과다(정규식 lastIndex 누수 없음)", () => {
  const text = "a (하나) b (둘)";
  assert.deepEqual(extractGaps(text), extractGaps(text));
});
