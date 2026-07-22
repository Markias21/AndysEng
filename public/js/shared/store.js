// 학습 데이터 저장소. localStorage에 단일 JSON으로 보관한다.
// 기록 종류: conversation/writing/expression(점수 있음), quiz(복습 결과), sessions(주제 시작 이벤트).
const DATA_KEY = "andyseng:data";

const RECORD_KINDS = ["conversation", "writing", "expression", "quiz", "sessions"];

// 유저 프로필(설정): CEFR 학습 레벨, 회화 표현 수집 개수, 화면 테마, AI 모델.
// 레벨/표현수는 회화·글쓰기·복습에 공통 적용. theme는 화면 색, model은 Claude 호출 모델.
// gender: 회화 💕연애에서 이성 상대를 정하는 기준. romancePartnerId: 고정된 연애 상대 페르소나 id.
const DEFAULT_PROFILE = { level: "B1", exprPerConv: 2, theme: "light", model: "claude-sonnet-5", gender: "male", romancePartnerId: "" };

function emptyData() {
  const records = {};
  for (const kind of RECORD_KINDS) records[kind] = [];
  // deck: 표현 복습 카드. words: 단어장 카드. dict: 사전 조회 영구 캐시(질의 → entries).
  // usage: 모델별 누적 AI 비용(달러, 추정치).
  return {
    version: 4,
    records,
    deck: [],
    words: [],
    dict: {},
    usage: {},
    profile: { ...DEFAULT_PROFILE },
    lastReportAt: null,
    lastSyncedAt: null,
  };
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
    words: Array.isArray(data.words) ? data.words : [],
    dict: data.dict && typeof data.dict === "object" ? data.dict : {},
    usage: data.usage && typeof data.usage === "object" ? data.usage : {},
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

export function getLastSyncedAt() {
  return load().lastSyncedAt;
}

export function setLastSyncedAt(ts) {
  load().lastSyncedAt = ts;
  save();
}

/**
 * 마지막 GitHub 동기화(저장/불러오기) 이후 새로 쌓인 항목을 부분별로 센다.
 * 한 번도 동기화하지 않았다면(lastSyncedAt=null) 전체를 미저장으로 센다.
 */
export function unsyncedCounts() {
  const data = load();
  const since = data.lastSyncedAt || 0;
  const counts = {};
  for (const kind of RECORD_KINDS) {
    counts[kind] = data.records[kind].filter((r) => new Date(r.ts).getTime() > since).length;
  }
  counts.deck = data.deck.filter((c) => c.addedAt > since).length;
  counts.words = data.words.filter((w) => w.addedAt > since).length;
  return counts;
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

/** 표현 복습 덱에서 카드 하나를 뺀다(마음에 안 드는 표현 제거). */
export function removeCard(id) {
  const data = load();
  const before = data.deck.length;
  data.deck = data.deck.filter((c) => c.id !== id);
  if (data.deck.length !== before) save();
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

// ===== 단어장 =====
export function getWords() {
  return load().words;
}

/**
 * 사전에서 고른 단어(뜻 하나)를 단어장 카드로 추가한다. 같은 단어+뜻(대소문자 무시)은 중복 저장하지 않는다.
 * item: {word, pos, meaning, example}. 반환: 추가했으면 true.
 */
export function addWord(item) {
  const words = load().words;
  const key = `${item.word.toLowerCase().trim()}|${item.meaning.trim()}`;
  if (words.some((w) => `${w.word.toLowerCase().trim()}|${w.meaning.trim()}` === key)) return false;
  const now = Date.now();
  // 새 카드는 바로 복습 대상(due=now). 간격 스케줄링은 srs 도메인(scheduler.js)이 맡는다.
  words.push({ id: crypto.randomUUID(), ...item, addedAt: now, streak: 0, interval: 0, due: now });
  save();
  return true;
}

export function updateWord(updated) {
  const words = load().words;
  const i = words.findIndex((w) => w.id === updated.id);
  if (i >= 0) words[i] = updated;
  save();
}

/** 단어장에서 카드 하나를 뺀다(마음에 안 드는 단어 제거). */
export function removeWord(id) {
  const data = load();
  const before = data.words.length;
  data.words = data.words.filter((w) => w.id !== id);
  if (data.words.length !== before) save();
}

// ===== 사전 조회 캐시 =====
// 같은 질의는 평생 한 번만 AI를 호출하도록 결과(entries)를 영구 보관한다. 키는 정규화된 질의.
export function getCachedLookup(key) {
  return load().dict[key] || null;
}

export function setCachedLookup(key, entries) {
  load().dict[key] = entries;
  save();
}

// ===== AI 사용 비용 =====
export function recordUsage(model, costUsd) {
  if (!costUsd) return;
  const data = load();
  data.usage[model] = (data.usage[model] || 0) + costUsd;
  save();
}

export function getUsage() {
  return load().usage;
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
