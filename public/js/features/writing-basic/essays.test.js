// 손으로 쓴 지문 데이터의 오타를 잡는 무결성 테스트.
// buildCloze/blanksFor는 shared/cloze.js·difficulty.js에서 이미 테스트하므로, 여기서는 essays 데이터 자체를 검증한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ESSAYS, findEssay, essaysOf } from "./essays.js";
import { TEMPLATES, findTemplate } from "./templates.js";
import { DIFFICULTIES, blanksFor } from "./difficulty.js";
import { buildCloze } from "../../shared/cloze.js";
import { writingPrompts } from "../writing/prompts.js";

function wordCount(essay) {
  return essay.sentences
    .map((s) => s.sentence)
    .join(" ")
    .trim()
    .split(/\s+/).length;
}

function modeOf(essay) {
  return findTemplate(essay.template)?.mode;
}

const discussionEssays = ESSAYS.filter((e) => modeOf(e) === "discussion");
const emailEssays = ESSAYS.filter((e) => modeOf(e) === "email");

test("essays: 40개(토론형 32 + 이메일 8), id가 유일하다", () => {
  assert.equal(ESSAYS.length, 40);
  assert.equal(discussionEssays.length, 32);
  assert.equal(emailEssays.length, 8);
  assert.equal(new Set(ESSAYS.map((e) => e.id)).size, ESSAYS.length);
});

test("essays: 토론형은 영문 250~300단어, 이메일은 110~160단어 분량이다", () => {
  for (const e of discussionEssays) {
    const words = wordCount(e);
    assert.ok(words >= 250 && words <= 300, `${e.id}: ${words}단어`);
  }
  for (const e of emailEssays) {
    const words = wordCount(e);
    assert.ok(words >= 110 && words <= 160, `${e.id}: ${words}단어`);
  }
});

test("essays: template이 실제 정의된 템플릿을 가리킨다", () => {
  for (const e of ESSAYS) {
    assert.ok(findTemplate(e.template), `${e.id}: 알 수 없는 template "${e.template}"`);
  }
});

test("essays: 토론형 prompt는 writing/prompts.js에 존재한다", () => {
  for (const e of discussionEssays) {
    assert.ok(writingPrompts.includes(e.prompt), `${e.id}: prompts.js에 없는 질문`);
  }
});

test("essays: 이메일 지문은 bullets가 정확히 3개다", () => {
  for (const e of emailEssays) {
    assert.equal(e.bullets?.length, 3, `${e.id}: bullets는 3개여야 함`);
    assert.ok(e.bullets.every((b) => typeof b === "string" && b.length > 0), `${e.id}: 빈 bullet`);
  }
});

test("essays: 모든 문장에 한국어 해석이 있다", () => {
  for (const e of ESSAYS) {
    for (const s of e.sentences) {
      assert.ok(s.translation && s.translation.length > 0, `${e.id}: 해석 누락 - "${s.sentence}"`);
    }
  }
});

test("essays: blanks의 level은 1~3 중 하나다", () => {
  for (const e of ESSAYS) {
    for (const b of e.blanks) {
      assert.ok([1, 2, 3].includes(b.level), `${e.id}: "${b.expression}" level=${b.level}`);
    }
  }
});

test("essays: 모든 난이도에서 선언한 빈칸이 본문에서 실제로 전부 발견된다", () => {
  for (const e of ESSAYS) {
    for (const d of DIFFICULTIES.map((x) => x.id)) {
      const blanks = blanksFor(e, d);
      const lines = buildCloze(e.sentences, blanks);
      const found = lines.flatMap((l) => l.blanks).length;
      assert.equal(found, blanks.length, `${e.id} (${d}): 기대 ${blanks.length}개, 실제 ${found}개 — 표현 철자나 겹침을 확인하세요`);
    }
  }
});

test("findEssay: id로 찾고 없으면 null", () => {
  assert.equal(findEssay("big-city-small-town").titleKo, "대도시 vs 소도시");
  assert.equal(findEssay("nope"), null);
});

test("essaysOf: 템플릿별로 걸러낸다", () => {
  for (const t of TEMPLATES) {
    const list = essaysOf(t.id);
    assert.ok(list.length > 0, `${t.id}: 지문이 없다`);
    assert.ok(list.every((e) => e.template === t.id));
  }
});
