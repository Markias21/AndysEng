// 손으로 쓴 문단 연습 데이터의 오타·불일치를 잡는 무결성 테스트.
// essays.test.js/sets.test.js와 같은 이유 — 손으로 쓴 데이터라도 레포에 실려 배포되는 이상 테스트가 필요하다.
// public/data/reading/은 매일 로테이션되는 살아있는 데이터라, 원본 기사와 대조하는 검증은 하지 않는다
// (임베드된 text 자체를 정적 콘텐츠로 취급 — essays.test.js도 원본 웹페이지를 재확인하지 않는 것과 같은 원칙).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ITEMS, CATEGORIES, itemsOf, findItem } from "./items.js";

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const MIN_WORDS = 25;

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

test("items: 200개(과학35·건강40·교육38·역사35·예술32·사회20), id가 유일하다", () => {
  assert.equal(ITEMS.length, 200);
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
});

test("items: category는 정의된 카테고리 중 하나다", () => {
  for (const item of ITEMS) {
    assert.ok(CATEGORY_IDS.includes(item.category), `${item.id}: 알 수 없는 category "${item.category}"`);
  }
});

test("items: 문단은 25단어 이상이고 중복이 없다", () => {
  const seen = new Set();
  for (const item of ITEMS) {
    const words = wordCount(item.text);
    assert.ok(words >= MIN_WORDS, `${item.id}: ${words}단어`);
    const key = item.text.trim().toLowerCase();
    assert.ok(!seen.has(key), `${item.id}: 중복된 문단`);
    seen.add(key);
  }
});

test("items: type은 mcq 또는 produce다", () => {
  for (const item of ITEMS) {
    assert.ok(["mcq", "produce"].includes(item.type), `${item.id}: 알 수 없는 type "${item.type}"`);
  }
});

const mcqItems = ITEMS.filter((i) => i.type === "mcq");
const produceItems = ITEMS.filter((i) => i.type === "produce");

test("items: mcq는 옵션 4개·유효한 정답 인덱스·문단 안에 있는 근거 문장을 갖는다", () => {
  for (const item of mcqItems) {
    const q = item.question;
    assert.ok(q, `${item.id}: question 없음`);
    assert.equal(q.options.length, 4, `${item.id}: 옵션 ${q.options.length}개`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, `${item.id}: answer=${q.answer}`);
    assert.ok(q.stem?.trim(), `${item.id}: stem 비어있음`);
    assert.ok(q.explanation_ko?.trim(), `${item.id}: explanation_ko 비어있음`);
    assert.ok(item.text.includes(q.evidence), `${item.id}: evidence가 text 안에 없음 — "${q.evidence}"`);
  }
});

test("items: produce는 유효한 task를 갖는다", () => {
  for (const item of produceItems) {
    assert.ok(["restate", "summary"].includes(item.task), `${item.id}: 알 수 없는 task "${item.task}"`);
  }
});

test("items: mcq:produce 비율이 대략 6:4다", () => {
  const ratio = mcqItems.length / ITEMS.length;
  assert.ok(ratio > 0.45 && ratio < 0.75, `mcq 비율: ${ratio.toFixed(2)}`);
});

test("itemsOf: 카테고리별로 걸러낸다", () => {
  for (const cat of CATEGORY_IDS) {
    const mine = itemsOf(cat);
    assert.ok(mine.length > 0, `${cat}: 항목 없음`);
    assert.ok(mine.every((i) => i.category === cat));
  }
  assert.equal(itemsOf(null).length, ITEMS.length);
});

test("findItem: id로 찾고 없으면 null", () => {
  assert.equal(findItem(ITEMS[0].id)?.id, ITEMS[0].id);
  assert.equal(findItem("no-such-id"), null);
});
