import { test } from "node:test";
import assert from "node:assert/strict";
import { dataPath } from "./github.js";

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
