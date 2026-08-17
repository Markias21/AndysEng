// 외부 서비스(Supabase Auth + PostgREST) 경계. 기능 코드는 이 모듈의 함수만 사용한다.
// 로그인 화면은 그대로 닉네임+비밀번호이고, 내부적으로만 닉네임을 가짜 이메일로 바꿔 Supabase 계정을 쓴다.
// 학습 기록은 사용자별 행 하나(andyseng_data, supabase/schema.sql)에 저장되고 RLS가 본인 행만 보이게 강제한다.
// 가입은 관리자 승인제다(supabase/002_approval.sql) — 신청 즉시 계정은 만들어지지만 profiles.status가
// pending인 동안은 RLS가 andyseng_data·shared_sets 접근을 전부 거부한다. 승인 여부는 관리자(닉네임 andy)가
// 앱 안 관리자 패널에서 정한다.
// Claude API 호출도 이 세션을 쓴다(claude.js가 getAccessToken()으로 Supabase Edge Function
// claude-proxy를 부른다 — 진짜 Anthropic 키는 브라우저에 없다, supabase/functions/claude-proxy).
const URL = "https://loixxhvevfjbokpjqsaq.supabase.co";
export const ANON_KEY = "sb_publishable_2DBuyYp3xW3NMkZ3wd8Ndw_6IIvUuQG"; // claude.js가 claude-proxy 호출에도 같이 쓴다
const EMAIL_DOMAIN = "andyseng.internal";
const TABLE = "andyseng_data";

let session = null; // { accessToken, refreshToken, expiresAt }
let knownUpdatedAt = null; // 마지막으로 안 원격 updated_at — 낙관적 잠금에 쓴다.

/** signup/token 응답(access_token·refresh_token·expires_in)을 세션으로 저장한다. */
function setSession(data) {
  session = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  knownUpdatedAt = null;
}

/** 닉네임을 Supabase 계정용 이메일 로컬파트로 바꾼다. 빈 값이면 throw. */
export function toSlug(nickname) {
  const slug = (nickname || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("닉네임이 비어 있습니다.");
  return slug;
}

/** 닉네임을 Supabase 계정용 이메일로 바꾼다. 빈 값이면 throw. */
export function toEmail(nickname) {
  return `${toSlug(nickname)}@${EMAIL_DOMAIN}`;
}

export function hasSession() {
  return session !== null;
}

export function clearSession() {
  session = null;
  knownUpdatedAt = null;
}

function authErrorMessage(data, status) {
  const msg = data?.msg || data?.error_description || data?.error || "";
  if (/already registered/i.test(msg)) return "이미 등록된 닉네임이에요.";
  if (/invalid login credentials/i.test(msg)) return "닉네임 또는 비밀번호가 올바르지 않아요.";
  if (/email not confirmed/i.test(msg)) return "계정이 확인되지 않았어요(관리자에게 문의).";
  if (/password/i.test(msg) && /least|short|weak/i.test(msg)) return "비밀번호가 너무 짧아요(6자 이상).";
  return msg || `계정 서버 요청 실패 (${status})`;
}

async function authRequest(path, body) {
  const res = await fetch(`${URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(authErrorMessage(data, res.status));
  return data;
}

/**
 * 계정 생성 + 가입 신청(profiles.status='pending'). 이미 등록된 닉네임이면 throw.
 * 신청 직후 세션을 지운다 — 승인 전까지는 로그인(signIn)으로만 다시 들어오게 하기 위해서다.
 */
export async function signUpRequest(nickname, password, note) {
  const data = await authRequest("signup", { email: toEmail(nickname), password });
  if (!data.access_token) {
    throw new Error("계정이 만들어졌지만 자동 로그인에 실패했어요. 다시 로그인해 주세요.");
  }
  setSession(data);
  try {
    await insertProfile(toSlug(nickname), note);
  } finally {
    clearSession();
  }
}

/** 로그인. 닉네임/비밀번호가 틀리면 throw. */
export async function signIn(nickname, password) {
  const data = await authRequest("token?grant_type=password", { email: toEmail(nickname), password });
  setSession(data);
}

/**
 * 유효한 access token을 반환한다. 만료 60초 전이면 refresh_token으로 조용히 갱신한다.
 * claude.js(claude-proxy 호출)와 dataRequest 양쪽이 쓴다 — access token TTL(1시간)이
 * 지나도 재로그인 없이 계속 쓸 수 있게 하기 위해서다.
 */
export async function getAccessToken() {
  if (!session) throw new Error("로그인되어 있지 않습니다.");
  if (Date.now() >= session.expiresAt - 60_000) {
    const data = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refreshToken });
    setSession(data);
  }
  return session.accessToken;
}

async function dataRequest(path, { method = "GET", body, extraHeaders = {} } = {}) {
  const accessToken = await getAccessToken();
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `저장소 요청 실패 (${res.status})`);
  }
  return res;
}

async function insertProfile(nickname, note) {
  await dataRequest("profiles", { method: "POST", body: { nickname, note: note || null } });
}

/** 내 가입 신청 상태. profiles 행이 아직 없으면(가입 중 네트워크가 끊겼던 경우 등) null. */
export async function fetchProfile(nickname) {
  const res = await dataRequest(`profiles?nickname=eq.${encodeURIComponent(toSlug(nickname))}&select=*`);
  const rows = await res.json();
  return rows.length ? rows[0] : null;
}

/** profiles 행이 없을 때 다시 신청한다(가입 신청이 중간에 끊겨 관리자 목록에 안 보이는 경우 복구용). */
export async function ensureProfile(nickname, note) {
  await insertProfile(toSlug(nickname), note);
  return fetchProfile(nickname);
}

/** 관리자용 — 전체 가입 신청 목록. 관리자가 아니면 RLS가 본인 행만 돌려준다. */
export async function listProfiles() {
  const res = await dataRequest("profiles?select=*&order=created_at.asc");
  return res.json();
}

/**
 * 관리자용 — 가입 신청 승인/거절. RLS에 막힌 PATCH는 200 + 0행으로 돌아오므로(에러가 아니다)
 * 반드시 반환된 행 수를 확인한다 — 아니면 관리자 화면이 거짓 성공을 보여줄 수 있다.
 */
export async function reviewProfile(userId, status) {
  const res = await dataRequest(`profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: { status, reviewed_at: new Date().toISOString() },
    extraHeaders: { Prefer: "return=representation" },
  });
  const rows = await res.json();
  if (!rows.length) throw new Error("승인 권한이 없거나 대상을 찾을 수 없어요.");
  return rows[0];
}

/**
 * 저장. 마지막으로 안 원격 updated_at을 알고 있으면 그 값이 여전히 맞을 때만 갱신한다(낙관적 잠금).
 * 그사이 다른 기기가 먼저 저장했으면(PATCH가 0행을 바꿈) 충돌로 던진다 — blind upsert로 덮어쓰지 않는다.
 * 알고 있는 updated_at이 없으면(첫 저장) insert한다.
 */
export async function saveRecord(jsonString) {
  const updated_at = new Date().toISOString();
  const body = { payload: JSON.parse(jsonString), updated_at };

  if (knownUpdatedAt) {
    const res = await dataRequest(`${TABLE}?updated_at=eq.${encodeURIComponent(knownUpdatedAt)}`, {
      method: "PATCH",
      body,
      extraHeaders: { Prefer: "return=representation" },
    });
    const rows = await res.json();
    if (!rows.length) {
      throw new Error("다른 기기에서 저장했어요. 불러오기 후 다시 저장해 주세요.");
    }
    knownUpdatedAt = updated_at;
    return;
  }

  await dataRequest(TABLE, {
    method: "POST",
    body,
    extraHeaders: { Prefer: "resolution=merge-duplicates" },
  });
  knownUpdatedAt = updated_at;
}

/** 불러오기. 저장된 적 없으면 null. 이후 saveRecord의 충돌 감지 기준이 될 updated_at을 함께 기억해 둔다. */
export async function loadRecord() {
  const res = await dataRequest(`${TABLE}?select=payload,updated_at`);
  const rows = await res.json();
  if (!rows.length) return null;
  knownUpdatedAt = rows[0].updated_at;
  return JSON.stringify(rows[0].payload);
}

/**
 * 모든 유저에게 동일한 생성 콘텐츠(리딩 문제 세트·6min 문제 세트·사전 조회)의 공용 캐시.
 * kind: "reading" | "sixmin" | "dict". 실패는 조용히 null로 떨어진다 — 개인 캐시(store.js)로
 * 폴백하는 기존 흐름을 오프라인·서버 오류에서도 깨지 않기 위해서다.
 */
export async function getShared(kind, key) {
  try {
    const res = await fetch(
      `${URL}/rest/v1/shared_sets?kind=eq.${encodeURIComponent(kind)}&key=eq.${encodeURIComponent(key)}&select=payload`,
      { headers: { apikey: ANON_KEY } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.length ? rows[0].payload : null;
  } catch {
    return null;
  }
}

/** 생성한 콘텐츠를 공용 캐시에 올린다. 이미 있으면 조용히 무시(첫 생성자 승, UPDATE 정책 자체가 없다). */
export async function putShared(kind, key, payload) {
  if (!session) return;
  try {
    await dataRequest("shared_sets", {
      method: "POST",
      body: { kind, key, payload },
      extraHeaders: { Prefer: "resolution=ignore-duplicates" },
    });
  } catch {
    /* 공용 캐시 업로드 실패는 무시 — 이 유저의 개인 캐시(store.js)에는 이미 저장돼 있다. */
  }
}
