import { test } from "node:test";
import assert from "node:assert/strict";
import { dataPath, toB64, fromB64 } from "./github.js";

test("dataPath: 정상 닉네임", () => {
  assert.equal(dataPath("andy"), "data/andy/andyseng-data.json");
});

test("dataPath: 앞뒤 공백은 trim한다", () => {
  assert.equal(dataPath("  andy  "), "data/andy/andyseng-data.json");
});

test("dataPath: 빈 닉네임은 throw", () => {
  assert.throws(() => dataPath(""));
  assert.throws(() => dataPath("   "));
  assert.throws(() => dataPath(undefined));
});

test("dataPath: 경로 문자가 섞이면 throw", () => {
  assert.throws(() => dataPath("andy/../secret"));
  assert.throws(() => dataPath("a/b"));
  assert.throws(() => dataPath(".."));
});

test("toB64/fromB64: 큰 문자열도 스택 초과 없이 왕복한다", () => {
  const big = "가나다한글abc123!@# ".repeat(200000); // 약 260만 자, 스프레드 인자 한도(수만) 훌쩍 초과
  const encoded = toB64(big);
  assert.equal(fromB64(encoded), big);
});

test("toB64/fromB64: 짧은 문자열도 정상 왕복한다", () => {
  assert.equal(fromB64(toB64("hello 안녕")), "hello 안녕");
});
