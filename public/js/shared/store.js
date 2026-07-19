// 학습 데이터 저장소. localStorage에 단일 JSON으로 보관한다.
// 기록 종류: conversation/writing/expression(점수 있음), quiz(복습 결과), sessions(주제 시작 이벤트).
const DATA_KEY = "andyseng:data";

const RECORD_KINDS = ["conversation", "writing", "expression", "quiz", "sessions"];

// 유저 프로필(설정): CEFR 학습 레벨, 회화 표현 수집 개수, 화면 테마, AI 모델.
// 레벨/표현수는 회화·글쓰기·복습에 공통 적용. theme는 화면 색, model은 Claude 호출 모델.
const DEFAULT_PROFILE = { level: "B1", exprPerConv: 2, theme: "light", model: "claude-sonnet-5" };

function emptyData() {
  const records = {};
  for (const kind of RECORD_KINDS) records[kind] = [];
  return { version: 2, records, deck: [], profile: { ...DEFAULT_PROFILE }, lastReportAt: null };
}

let cache = null;

function load() {
  if (cache) return cache;
  const raw = localStorage.getItem(DATA_KEY);
  cache = raw ? normalize(JSON.parse(raw)) : emptyData();
  return cache;
}

function normalize(data) {
  const base = emptyData();
  return {
    ...base,
    ...data,
    records: { ...base.records, ...(data.records || {}) },
    profile: { ...base.profile, ...(data.profile || {}) },
  };
}

function save() {
  localStorage.setItem(DATA_KEY, JSON.stringify(cache));
}

export function appendRecord(kind, record) {
  const data = load();
  data.records[kind].push({ ts: new Date().toISOString(), ...record });
  save();
}

export function getRecords(kind) {
  return load().records[kind];
}

export function getAllRecords() {
  return load().records;
}

export function getLastReportAt() {
  return load().lastReportAt;
}

export function setLastReportAt(ts) {
  load().lastReportAt = ts;
  save();
}

// ===== 프로필(설정) =====
export function getProfile() {
  return load().profile;
}

export function setProfile(patch) {
  const data = load();
  data.profile = { ...data.profile, ...patch };
  save();
  return data.profile;
}

// ===== 복습 덱 =====
export function getDeck() {
  return load().deck;
}

/**
 * 옛 "표현 공부"에서 쌓인 카드(source가 "expression"으로 시작)를 덱에서 제거한다.
 * 표현 영역을 없애고 복습이 회화·글쓰기 표현만 다루도록 바꾸면서, 앱 시작 시 한 번 정리한다.
 * 제거한 개수를 반환한다.
 */
export function purgeExpressionCards() {
  const data = load();
  const before = data.deck.length;
  data.deck = data.deck.filter((c) => !String(c.source || "").startsWith("expression"));
  const removed = before - data.deck.length;
  if (removed) save();
  return removed;
}

export function updateCard(updated) {
  const deck = load().deck;
  const i = deck.findIndex((c) => c.id === updated.id);
  if (i >= 0) deck[i] = updated;
  save();
}

/**
 * 배운 표현들을 새 복습 카드로 덱에 추가한다. 같은 표현(대소문자 무시)은 중복 저장하지 않는다.
 * items: [{expression, meaning, example, source}]
 */
export function addToDeck(items) {
  const deck = load().deck;
  const known = new Set(deck.map((c) => c.expression.toLowerCase().trim()));
  const now = Date.now();
  let added = 0;
  for (const item of items) {
    const key = item.expression.toLowerCase().trim();
    if (known.has(key)) continue;
    known.add(key);
    // 새 카드는 바로 복습 대상(due=now). 이후 스케줄링은 srs 도메인(scheduler.js)이 맡는다.
    deck.push({ id: crypto.randomUUID(), ...item, addedAt: now, streak: 0, interval: 0, due: now });
    added += 1;
  }
  if (added) save();
  return added;
}

// ===== 백업 =====
export function exportJSON() {
  return JSON.stringify(load(), null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !parsed.records) {
    throw new Error("AndysEng 백업 파일이 아닙니다.");
  }
  cache = normalize(parsed);
  save();
}
