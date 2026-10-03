import { test } from "node:test";
import assert from "node:assert/strict";
import { stampRecord, withoutSharedCaches } from "./store.js";

test("withoutSharedCaches: readingSets·sixMinSets·dict를 뺀다", () => {
  const data = {
    version: 8,
    records: { writing: [] },
    deck: [],
    readingSets: { "123": { questions: [] } },
    sixMinSets: { "260804": { questions: [] } },
    dict: { "en:make": [] },
    profile: { level: "B1" },
  };
  const result = withoutSharedCaches(data);
  assert.deepEqual(result, {
    version: 8,
    records: { writing: [] },
    deck: [],
    profile: { level: "B1" },
  });
});

test("withoutSharedCaches: 세 캐시가 비어 있어도 그대로 동작한다", () => {
  const data = { records: {}, readingSets: {}, sixMinSets: {}, dict: {} };
  assert.deepEqual(withoutSharedCaches(data), { records: {} });
});

test("stampRecord: rid와 ts를 붙이되 호출자가 넘긴 값이 이긴다", () => {
  const r = stampRecord({ score: 80 }, "fixed-rid", "2026-10-05T00:00:00.000Z");
  assert.deepEqual(r, { rid: "fixed-rid", ts: "2026-10-05T00:00:00.000Z", score: 80 });

  // 불러오기한 기록을 그대로 다시 넣는 경우 원래 rid·ts가 보존돼야 한다.
  const kept = stampRecord({ rid: "old", ts: "2020-01-01T00:00:00.000Z", score: 1 });
  assert.equal(kept.rid, "old");
  assert.equal(kept.ts, "2020-01-01T00:00:00.000Z");
});

test("stampRecord: quiz 기록의 id(복습 카드 id)를 건드리지 않는다", () => {
  // id를 기록 고유 id로 쓰면 features/srs/history.js의 카드별 이력이 전부 깨진다.
  const r = stampRecord({ id: "card-123", correct: true, kind: "expression" });
  assert.equal(r.id, "card-123");
  assert.ok(r.rid && r.rid !== r.id);
});

test("stampRecord: 기본 rid는 매번 다르다", () => {
  assert.notEqual(stampRecord({}).rid, stampRecord({}).rid);
});
