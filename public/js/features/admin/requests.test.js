import { test } from "node:test";
import assert from "node:assert/strict";
import { sortRequests, statusLabel } from "./requests.js";

function profile(overrides) {
  return { user_id: "u", nickname: "n", note: null, status: "pending", created_at: "2026-01-01T00:00:00Z", ...overrides };
}

test("sortRequests: pending이 approved/rejected보다 먼저 온다", () => {
  const input = [
    profile({ user_id: "a", status: "approved", created_at: "2026-01-01T00:00:00Z" }),
    profile({ user_id: "b", status: "pending", created_at: "2026-01-02T00:00:00Z" }),
    profile({ user_id: "c", status: "rejected", created_at: "2026-01-03T00:00:00Z" }),
  ];
  const sorted = sortRequests(input);
  assert.deepEqual(sorted.map((p) => p.user_id), ["b", "a", "c"]);
});

test("sortRequests: 같은 상태끼리는 신청 오래된 순", () => {
  const input = [
    profile({ user_id: "new", status: "pending", created_at: "2026-01-05T00:00:00Z" }),
    profile({ user_id: "old", status: "pending", created_at: "2026-01-01T00:00:00Z" }),
  ];
  const sorted = sortRequests(input);
  assert.deepEqual(sorted.map((p) => p.user_id), ["old", "new"]);
});

test("sortRequests: 원본 배열을 변형하지 않는다", () => {
  const input = [profile({ user_id: "a" }), profile({ user_id: "b" })];
  const copy = input.slice();
  sortRequests(input);
  assert.deepEqual(input, copy);
});

test("statusLabel: 알려진 상태는 한글 라벨", () => {
  assert.equal(statusLabel("pending"), "⏳ 대기 중");
  assert.equal(statusLabel("approved"), "✅ 승인됨");
  assert.equal(statusLabel("rejected"), "🚫 거절됨");
});
