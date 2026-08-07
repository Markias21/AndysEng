import { test } from "node:test";
import assert from "node:assert/strict";
import { withoutSharedCaches } from "./store.js";

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
