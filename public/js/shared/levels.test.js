import { test } from "node:test";
import assert from "node:assert/strict";
import { levelIndex, isLevel, levelDistance, filterByLevel } from "./levels.js";

test("levelIndex는 CEFR 순서를 반환하고 미지값은 -1", () => {
  assert.equal(levelIndex("A1"), 0);
  assert.equal(levelIndex("C2"), 5);
  assert.equal(levelIndex("Z9"), -1);
});

test("isLevel은 유효한 CEFR만 참", () => {
  assert.equal(isLevel("B1"), true);
  assert.equal(isLevel("b1"), false);
  assert.equal(isLevel(undefined), false);
});

test("levelDistance는 칸 수, 미지값은 Infinity", () => {
  assert.equal(levelDistance("A1", "B1"), 2);
  assert.equal(levelDistance("B2", "B2"), 0);
  assert.equal(levelDistance("A1", "??"), Infinity);
});

test("filterByLevel은 ±span 범위 카드만, 레벨 없는 카드는 항상 포함", () => {
  const cards = [
    { expression: "a", level: "A1" },
    { expression: "b", level: "B1" },
    { expression: "c", level: "B2" },
    { expression: "d", level: "C2" },
    { expression: "e" }, // 레벨 없음
  ];
  const got = filterByLevel(cards, "B1", 1).map((c) => c.expression);
  // B1 ±1 = A2,B1,B2 → b, c 포함. A1(거리2)·C2 제외. 레벨 없는 e 포함.
  assert.deepEqual(got.sort(), ["b", "c", "e"]);
});

test("filterByLevel은 미지 유저 레벨이면 전체 반환", () => {
  const cards = [{ expression: "a", level: "A1" }];
  assert.deepEqual(filterByLevel(cards, "??"), cards);
});
