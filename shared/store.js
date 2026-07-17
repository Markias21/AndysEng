import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 학습 기록 저장소 (JSON 파일). 멀티유저: 사용자별로 기록을 분리한다.
// 스키마: { users: { <userId>: { profile, tokens, settings, lastReportAt, records } }, sessions: {} }
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const EMPTY = { users: {}, sessions: {} };

function emptyRecords() {
  return { conversation: [], writing: [], expression: [] };
}

function load() {
  if (!fs.existsSync(STORE_PATH)) return structuredClone(EMPTY);
  return { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) };
}

function save(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function requireUser(store, userId) {
  const user = store.users[userId];
  if (!user) throw new Error(`알 수 없는 사용자: ${userId}`);
  return user;
}

// ===== 사용자 =====

/**
 * 구글 프로필로 사용자를 생성하거나 갱신한다.
 * profile: { sub, email, name, picture }. refresh_token은 첫 동의 때만 오므로 없으면 기존 값을 유지한다.
 */
export function upsertUser(profile, refreshToken) {
  const store = load();
  const id = profile.sub;
  const existing = store.users[id];
  store.users[id] = {
    profile: { id, email: profile.email, name: profile.name, picture: profile.picture || "" },
    tokens: { refresh_token: refreshToken || existing?.tokens?.refresh_token || null },
    settings: existing?.settings || { andysNoteLinked: false },
    lastReportAt: existing?.lastReportAt || null,
    records: existing?.records || emptyRecords(),
  };
  save(store);
  return store.users[id];
}

export function getUser(userId) {
  return load().users[userId] || null;
}

export function setUserSetting(userId, key, value) {
  const store = load();
  const user = requireUser(store, userId);
  user.settings[key] = value;
  save(store);
}

export function setLastReportAt(userId, ts) {
  const store = load();
  const user = requireUser(store, userId);
  user.lastReportAt = ts;
  save(store);
}

// ===== 학습 기록 (사용자 스코프) =====

export function appendRecord(userId, feature, record) {
  const store = load();
  const user = requireUser(store, userId);
  if (!(feature in user.records)) throw new Error(`알 수 없는 기능: ${feature}`);
  user.records[feature].push({ ts: new Date().toISOString(), ...record });
  save(store);
}

export function getRecords(userId, feature) {
  const store = load();
  const user = requireUser(store, userId);
  if (!(feature in user.records)) throw new Error(`알 수 없는 기능: ${feature}`);
  return user.records[feature];
}

// ===== 세션 =====

export function createSessionRecord(token, userId, expiresAt) {
  const store = load();
  store.sessions[token] = { userId, expiresAt };
  save(store);
}

export function getSession(token) {
  return load().sessions[token] || null;
}

export function deleteSession(token) {
  const store = load();
  if (token in store.sessions) {
    delete store.sessions[token];
    save(store);
  }
}
