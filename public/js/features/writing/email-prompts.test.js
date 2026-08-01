import { test } from "node:test";
import assert from "node:assert/strict";
import { emailPrompts } from "./email-prompts.js";

const CATEGORIES = ["request", "complaint", "feedback", "apology"];

test("emailPrompts: 32개, id가 유일하다", () => {
  assert.equal(emailPrompts.length, 32);
  assert.equal(new Set(emailPrompts.map((p) => p.id)).size, emailPrompts.length);
});

test("emailPrompts: 카테고리 4종에 8개씩 고르게 분포한다", () => {
  for (const cat of CATEGORIES) {
    assert.equal(emailPrompts.filter((p) => p.category === cat).length, 8, cat);
  }
  assert.ok(emailPrompts.every((p) => CATEGORIES.includes(p.category)));
});

test("emailPrompts: 모든 항목이 titleKo·recipient·situation을 갖고 bullets가 정확히 3개다", () => {
  for (const p of emailPrompts) {
    assert.ok(p.titleKo?.length > 0, `${p.id}: titleKo 누락`);
    assert.ok(p.recipient?.length > 0, `${p.id}: recipient 누락`);
    assert.ok(p.situation?.length > 0, `${p.id}: situation 누락`);
    assert.equal(p.bullets?.length, 3, `${p.id}: bullets는 3개여야 함`);
    assert.ok(p.bullets.every((b) => typeof b === "string" && b.length > 0), `${p.id}: 빈 bullet`);
  }
});
