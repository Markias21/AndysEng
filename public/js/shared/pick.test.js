import { test } from "node:test";
import assert from "node:assert/strict";
import { pickFresh } from "./pick.js";

test("최근에 쓰지 않은 항목만 후보가 된다", () => {
  const pool = ["a", "b", "c"];
  for (let i = 0; i < 50; i++) {
    const picked = pickFresh(pool, ["a", "b"]);
    assert.equal(picked, "c");
  }
});

test("모든 항목이 최근이면 전체에서 고른다", () => {
  const pool = ["a", "b", "c"];
  const picked = pickFresh(pool, ["a", "b", "c"]);
  assert.ok(pool.includes(picked));
});

test("keyOf로 객체 항목을 비교한다", () => {
  const pool = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const picked = pickFresh(pool, [1, 3], (x) => x.id);
  assert.equal(picked.id, 2);
});

test("빈 풀은 null", () => {
  assert.equal(pickFresh([], []), null);
  assert.equal(pickFresh(null, []), null);
});

test("recentKeys가 비면 아무거나 하나 고른다", () => {
  const pool = ["a", "b", "c"];
  const picked = pickFresh(pool, []);
  assert.ok(pool.includes(picked));
});
