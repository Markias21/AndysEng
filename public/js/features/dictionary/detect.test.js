import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDirection, cacheKey } from "./detect.js";

test("detectDirection: 한글이 있으면 ko, 아니면 en", () => {
  assert.equal(detectDirection("만들다"), "ko");
  assert.equal(detectDirection("make"), "en");
  assert.equal(detectDirection("사과 apple"), "ko"); // 한글 하나라도 있으면 ko
  assert.equal(detectDirection("get along"), "en");
  assert.equal(detectDirection("ㅎ"), "ko"); // 자모도 한국어로
});

test("detectDirection: 빈 값은 en으로", () => {
  assert.equal(detectDirection(""), "en");
  assert.equal(detectDirection(null), "en");
  assert.equal(detectDirection(undefined), "en");
});

test("cacheKey: 방향 접두어 + 대소문자·공백 정규화", () => {
  assert.equal(cacheKey("  Make  "), "en:make");
  assert.equal(cacheKey("GET   the  Hang"), "en:get the hang");
  assert.equal(cacheKey("만들다"), "ko:만들다");
  // 같은 단어의 표기 차이는 한 키로 모인다
  assert.equal(cacheKey("make"), cacheKey("MAKE"));
});
