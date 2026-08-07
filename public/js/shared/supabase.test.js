import { test } from "node:test";
import assert from "node:assert/strict";
import { toEmail } from "./supabase.js";

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
