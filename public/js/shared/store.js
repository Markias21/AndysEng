// 학습 데이터 저장소. localStorage에 단일 JSON으로 보관한다.
// 기록 종류: conversation/writing/expression(점수 있음), quiz(복습 결과), sessions(주제 시작 이벤트).
const DATA_KEY = "andyseng:data";

const RECORD_KINDS = ["conversation", "writing", "expression", "quiz", "sessions"];

function emptyData() {
  const records = {};
  for (const kind of RECORD_KINDS) records[kind] = [];
  return { version: 2, records, deck: [], exprQueue: [], lastReportAt: null };
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

// ===== 복습 덱 =====
export function getDeck() {
  return load().deck;
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

// ===== 표현 큐 (API 호출 절약: 한 번에 여러 개 받아서 쌓아둠) =====
export function takeQueuedExpression() {
  const data = load();
  const next = data.exprQueue.shift() || null;
  if (next) save();
  return next;
}

export function queueExpressions(list) {
  load().exprQueue.push(...list);
  save();
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
