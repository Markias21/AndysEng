// 사전: 회화·글쓰기에서 📖 버튼으로 여는 모달. 양방향(한↔영) 조회.
// 뜻이 크게 다른 범주만 분리해 각 범주 예문 1개를 준다. AI 호출은 Haiku 고정(빠르고 저렴),
// 결과는 영구 캐시(store.dict)에 저장해 같은 단어는 평생 한 번만 토큰을 쓴다.
// 각 항목은 개별적으로 단어장(store.words)에 담을 수 있다.
import { chatJSON } from "../../shared/claude.js";
import { getCachedLookup, setCachedLookup, addWord } from "../../shared/store.js";
import { detectDirection, cacheKey } from "./detect.js";
import { $, esc, toast } from "../../shared/dom.js";

// 사전은 항상 Haiku로. 설정의 회화·채점 모델과 무관하게 고정한다.
const DICT_MODEL = "claude-haiku-4-5-20251001";

const ENTRY_ITEM = {
  type: "object",
  properties: {
    word: { type: "string", description: "표제 영단어(구동사 포함)" },
    phonetic: { type: "string", description: "IPA 발음 기호, 예: /meɪk/. 모르면 빈 문자열" },
    pos: { type: "string", description: "품사를 한국어로, 예: 동사·명사·형용사" },
    meaning: { type: "string", description: "이 범주의 뜻을 한국어로 짧게" },
    example: { type: "string", description: "이 뜻을 보여주는 자연스러운 영어 예문 1개" },
  },
  required: ["word", "phonetic", "pos", "meaning", "example"],
  additionalProperties: false,
};

const DICT_SCHEMA = {
  type: "object",
  properties: { entries: { type: "array", items: ENTRY_ITEM } },
  required: ["entries"],
  additionalProperties: false,
};

function systemFor(direction) {
  const shared = `You are an English-Korean dictionary for a Korean learner studying for the TOEFL.
Merge trivially similar senses; create a separate entry ONLY when a meaning is clearly different in category (e.g. make = "만들다" vs "~하게 하다"). Give at most 5 entries, most common first. Each entry needs exactly one natural example sentence and a Korean part of speech.`;
  if (direction === "ko") {
    return `${shared}
The query is Korean. Return the English word(s) that best express that meaning; each distinct English word or nuance is its own entry, with its Korean meaning and one example.`;
  }
  return `${shared}
The query is an English word or phrase. Return its distinct meaning categories in Korean, each with one example.`;
}

async function lookup(query) {
  const key = cacheKey(query);
  const cached = getCachedLookup(key);
  if (cached) return cached;
  const direction = detectDirection(query);
  const { entries } = await chatJSON({
    system: systemFor(direction),
    messages: [{ role: "user", content: `Query: ${query}` }],
    schema: DICT_SCHEMA,
    modelOverride: DICT_MODEL,
    maxTokens: 1024,
  });
  setCachedLookup(key, entries);
  return entries;
}

// 항목 데이터는 DOM dataset 대신 배열 인덱스로 참조한다(예문에 따옴표가 있어도 안전).
let lastEntries = [];

function entryHTML(entry, i) {
  return `<div class="dict-entry">
      <div class="dict-entry-head">
        <span class="dict-word">${esc(entry.word)}</span>
        ${entry.phonetic ? `<span class="dict-phonetic">${esc(entry.phonetic)}</span>` : ""}
        <span class="dict-pos">${esc(entry.pos)}</span>
      </div>
      <div class="dict-meaning">${esc(entry.meaning)}</div>
      <div class="dict-example">${esc(entry.example)}</div>
      <button class="btn-secondary dict-add" type="button" data-i="${i}">➕ 단어장에 추가</button>
    </div>`;
}

function renderResults(entries) {
  lastEntries = entries;
  const box = $("#dict-results");
  if (!entries.length) {
    box.innerHTML = `<p class="muted">결과가 없어요. 철자를 확인해 주세요.</p>`;
    return;
  }
  box.innerHTML = entries.map(entryHTML).join("");
  box.querySelectorAll(".dict-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entry = lastEntries[Number(btn.dataset.i)];
      const added = addWord({ word: entry.word, pos: entry.pos, meaning: entry.meaning, example: entry.example });
      toast(added ? `단어장에 담았어요: ${entry.word}` : "이미 단어장에 있는 단어예요.");
      btn.disabled = true;
      btn.textContent = added ? "✓ 담김" : "이미 있음";
    });
  });
}

async function onSearch(ev) {
  ev.preventDefault();
  const query = $("#dict-input").value.trim();
  if (!query) return;
  const btn = $("#dict-search-btn");
  btn.disabled = true;
  $("#dict-results").innerHTML = `<p class="muted">찾는 중...</p>`;
  try {
    renderResults(await lookup(query));
  } catch (e) {
    $("#dict-results").innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
  } finally {
    btn.disabled = false;
  }
}

function openModal() {
  $("#dict-modal").classList.remove("hidden");
  $("#dict-input").focus();
}

function closeModal() {
  $("#dict-modal").classList.add("hidden");
}

export function init() {
  $("#dict-form").addEventListener("submit", onSearch);
  $("#dict-close").addEventListener("click", closeModal);
  $("#dict-modal").addEventListener("click", (ev) => {
    if (ev.target.id === "dict-modal") closeModal();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !$("#dict-modal").classList.contains("hidden")) closeModal();
  });
  document.querySelectorAll(".dict-open-btn").forEach((b) => b.addEventListener("click", openModal));
}
