import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, HOBBY_SUBS, topicPool, findCategory } from "./categories.js";

test("8개 카테고리가 모두 있다", () => {
  const ids = CATEGORIES.map((c) => c.id);
  assert.deepEqual(
    ids,
    ["university", "romance", "values", "study", "career", "counsel", "hobby", "etc"]
  );
});

test("topics 타입 카테고리는 비지 않은 주제 풀을 갖는다", () => {
  for (const c of CATEGORIES.filter((c) => c.type === "topics")) {
    assert.ok(topicPool(c.id).length > 0, `${c.id} 풀 비어있음`);
  }
});

test("취미 하위(자율 제외)는 주제 풀을 갖는다", () => {
  for (const s of HOBBY_SUBS.filter((s) => s.id !== "free")) {
    assert.ok(topicPool("hobby", s.id).length > 0, `hobby_${s.id} 풀 비어있음`);
  }
});

test("자율(free) 취미는 정적 주제 풀이 없다(플레이어가 먼저 시작)", () => {
  assert.equal(topicPool("hobby", "free").length, 0);
});

test("모든 주제는 id·scene·opening을 갖고 id는 전역에서 유일하다", () => {
  const all = [];
  for (const c of CATEGORIES.filter((c) => c.type === "topics")) all.push(...topicPool(c.id));
  for (const s of HOBBY_SUBS.filter((s) => s.id !== "free")) all.push(...topicPool("hobby", s.id));
  for (const t of all) assert.ok(t.id && t.scene && t.opening, `${t.id} 누락`);
  const ids = all.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "주제 id 중복");
});

test("findCategory는 id로 찾고 없으면 null", () => {
  assert.equal(findCategory("romance")?.type, "romance");
  assert.equal(findCategory("nope"), null);
});
