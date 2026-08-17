import { test } from "node:test";
import assert from "node:assert/strict";
import { toEmail, signIn, getAccessToken, clearSession } from "./supabase.js";

/** authRequest가 매번 새 토큰을 만들도록 fetch를 모킹한다. 호출 횟수로 갱신 여부를 검증한다. */
function mockAuthFetch() {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        access_token: `token-${calls}`,
        refresh_token: `refresh-${calls}`,
        expires_in: 3600,
      }),
    };
  };
  return () => calls;
}

test("toEmail: 닉네임을 소문자 슬러그 이메일로 바꾼다", () => {
  assert.equal(toEmail("andy"), "andy@andyseng.internal");
});

test("toEmail: 대문자·공백·특수문자를 정규화한다", () => {
  assert.equal(toEmail("  Andy Kim! "), "andy-kim@andyseng.internal");
});

test("toEmail: 빈 닉네임은 throw", () => {
  assert.throws(() => toEmail(""));
  assert.throws(() => toEmail("   "));
  assert.throws(() => toEmail(undefined));
});

test("toEmail: 특수문자만 있는 닉네임도 throw", () => {
  assert.throws(() => toEmail("!!!"));
});

test("getAccessToken: 만료 전이면 갱신 없이 같은 토큰을 돌려준다", async (t) => {
  const originalFetch = globalThis.fetch;
  const getCalls = mockAuthFetch();
  t.after(() => {
    globalThis.fetch = originalFetch;
    clearSession();
  });

  await signIn("andy", "pw123456"); // 1회 호출
  const token1 = await getAccessToken();
  const token2 = await getAccessToken();

  assert.equal(token1, "token-1");
  assert.equal(token2, "token-1");
  assert.equal(getCalls(), 1);
});

test("getAccessToken: 만료 60초 이내면 refresh_token으로 조용히 갱신한다", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const getCalls = mockAuthFetch();
  t.after(() => {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    clearSession();
  });

  await signIn("andy", "pw123456"); // 1회 호출, expiresAt = now + 3600s
  Date.now = () => originalNow() + 3600_000 - 30_000; // 만료 30초 전 — 갱신 대상
  const token = await getAccessToken(); // 2회 호출(갱신)

  assert.equal(token, "token-2");
  assert.equal(getCalls(), 2);
});
