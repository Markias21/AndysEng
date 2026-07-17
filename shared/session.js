import crypto from "node:crypto";
import { createSessionRecord, getSession, deleteSession, getUser } from "./store.js";

// 세션 경계. 외부 라이브러리 없이 랜덤 불투명 토큰을 HttpOnly 쿠키에 담고 store에 보관한다.
const SESSION_COOKIE = "andyseng_sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  createSessionRecord(token, userId, Date.now() + SESSION_TTL_MS);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

/** 요청의 세션 쿠키로 현재 사용자 프로필을 찾는다. 없거나 만료면 null. */
export function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = getSession(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    deleteSession(token);
    return null;
  }
  const user = getUser(session.userId);
  return user ? { ...user.profile } : null;
}

export function logout(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) deleteSession(token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** 보호된 API 미들웨어. req.user = { id, email, name, picture } 를 세팅한다. */
export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "로그인이 필요합니다." });
  req.user = user;
  next();
}
