// 복습 화면: 회화·글쓰기에서 배운 표현(deck) + 사전에서 담은 단어(words)를 한 큐에서 함께 복습한다.
//
// 흐름: 표현/단어만 보여 주고 [🙂 기억나요 / 😵 까먹었어요]로 먼저 자가평가한다.
//  그 다음 뜻+예시를 보여주고 두 갈래로 나뉜다:
//   - ✍️ 예문 만들기: AI가 첨삭한다. 기억나요였다면 [😵 잘못 생각했어요 / 다음 →]로 진짜 기억했는지
//     최종 확인한다('다음'=간격 상승, '잘못 생각했어요'/까먹었어요=처음으로).
//   - ⏭ 예문 없이 넘어가기: 첨삭 없이 방금 한 자가평가를 그대로 다음 간격 결정에 쓴다.
// AI 채점은 피드백(첨삭·원어민 문장·등급)만 담당하고, 다음 복습 시점은 자가평가(+선택적 최종 확인)가 정한다.
// 유저 레벨(±1) 밖의 표현 카드는 이번 복습에서 제외한다(단어 카드는 레벨 태그가 없어 항상 포함).
import { review, dueCards, INTERVALS } from "./scheduler.js";
import { chatJSON } from "../../shared/claude.js";
import { getDeck, updateCard, removeCard, getWords, updateWord, removeWord, appendRecord, getProfile } from "../../shared/store.js";
import { scoreDetail } from "../../shared/scoring.js";
import { filterByLevel } from "../../shared/levels.js";
import { $, esc, toast, scoreBreakdownHTML, correctionsHTML } from "../../shared/dom.js";

let queue = [];
let current = null; // { kind: "expression"|"word", raw, term, meaning, example, pos, level }
let recalled = false; // 이번 항목에서 '기억나요'를 눌렀는지
let sessionTotal = 0;
let sessionRemembered = 0;

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    corrections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          reason: { type: "string", description: "이유를 한국어로" },
        },
        required: ["original", "corrected", "reason"],
        additionalProperties: false,
      },
    },
    natural_version: { type: "string", description: "원어민이라면 이렇게 쓸 문장" },
    comment: { type: "string", description: "표현을 제대로 활용했는지 한국어로 한두 문장" },
    grades: {
      type: "object",
      description: "각 배점 요소를 S/A/B/C/F로 채점",
      properties: {
        naturalness: { type: "string", enum: ["S", "A", "B", "C", "F"] },
        grammar: { type: "string", enum: ["S", "A", "B", "C", "F"] },
        comprehension: { type: "string", enum: ["S", "A", "B", "C", "F"] },
      },
      required: ["naturalness", "grammar", "comprehension"],
      additionalProperties: false,
    },
  },
  required: ["corrections", "natural_version", "comment", "grades"],
  additionalProperties: false,
};

/** 표현 카드/단어 카드를 복습 화면에서 공통으로 다루기 위한 어댑터. */
function wrap(raw, kind) {
  return {
    kind,
    raw,
    term: kind === "word" ? raw.word : raw.expression,
    meaning: raw.meaning,
    example: raw.example,
    pos: raw.pos,
    level: raw.level,
  };
}

function dueLabel(card, now) {
  if (card.due <= now) return `<span class="due-now">지금</span>`;
  const days = Math.ceil((card.due - now) / (24 * 60 * 60 * 1000));
  return `${days}일 후`;
}

function nounFor(kind) {
  return kind === "word" ? "단어" : "표현";
}

function allItems() {
  return [...getDeck().map((c) => wrap(c, "expression")), ...getWords().map((w) => wrap(w, "word"))];
}

function dueItems(level) {
  const expr = filterByLevel(dueCards(getDeck(), Date.now()), level, 1).map((c) => wrap(c, "expression"));
  const words = dueCards(getWords(), Date.now()).map((w) => wrap(w, "word"));
  return [...expr, ...words];
}

function removeItem(item) {
  if (item.kind === "word") removeWord(item.raw.id);
  else removeCard(item.raw.id);
}

function renderHome() {
  const now = Date.now();
  const level = getProfile().level;
  const items = allItems().sort((a, b) => a.raw.due - b.raw.due);
  const due = dueItems(level);
  const rows = items
    .map(
      (it) =>
        `<div class="stat-row"><span>${it.kind === "word" ? "📖" : "🔁"} <b>${esc(it.term)}</b>${it.level ? ` <span class="cefr">${esc(it.level)}</span>` : ""}</span><span class="row-actions">${dueLabel(it.raw, now)}<button class="btn-text card-remove" data-id="${it.raw.id}" data-kind="${it.kind}" title="복습에서 빼기">🗑</button></span></div>`
    )
    .join("");

  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🔁 복습</h2>
      <p>회화·글쓰기에서 배운 표현과 📖 사전으로 담은 단어가 여기 함께 쌓여요.<br/>
      먼저 기억나는지 스스로 확인하고, 원하면 예문을 만들어 AI 첨삭도 받아요(선택). 망각곡선(${INTERVALS.slice(0, 4).join("→")}일…)에 맞춰 복습합니다.</p>
      <p class="muted small">표현 카드는 내 레벨 <b>${esc(level)}</b> 근처(±1)만 나와요. 레벨은 상단에서 바꿀 수 있어요.</p>
      ${
        items.length === 0
          ? `<p class="muted">아직 쌓인 게 없어요. 회화·글쓰기를 하거나 📖 사전에서 단어를 담아 보세요.</p>`
          : due.length === 0
            ? `<p class="muted">지금 복습할 게 없어요. 전체 ${items.length}개가 예정대로 기다리고 있어요.</p>`
            : `<button class="btn-primary" id="srs-start">복습 시작 (${due.length}개)</button>`
      }
    </div>
    ${items.length ? `<details class="history"><summary>📚 내 복습 목록 (${items.length})</summary><div class="card">${rows}</div></details>` : ""}`;

  const startBtn = $("#srs-start");
  if (startBtn) startBtn.addEventListener("click", startSession);
  $("#srs-content")
    .querySelectorAll(".card-remove")
    .forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.kind === "word") removeWord(b.dataset.id);
        else removeCard(b.dataset.id);
        toast("복습에서 뺐어요.");
        renderHome();
      })
    );
}

function startSession() {
  queue = dueItems(getProfile().level);
  sessionTotal = 0;
  sessionRemembered = 0;
  nextQuestion();
}

// 1단계: 표현/단어만 보여 주고 기억 여부를 먼저 묻는다.
function nextQuestion() {
  current = queue.shift() || null;
  if (!current) return renderSummary();
  const remaining = queue.length + 1;
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">이 ${nounFor(current.kind)}, 기억나요? · 남은 항목 ${remaining}</span>
      <h3 class="expr-word">${esc(current.term)}</h3>
      ${current.kind === "word" && current.pos ? `<p class="dict-pos">${esc(current.pos)}</p>` : ""}
      <div class="row-rate">
        <button class="btn-secondary" id="srs-forgot" type="button">😵 까먹었어요</button>
        <button class="btn-primary" id="srs-recall" type="button">🙂 기억나요</button>
      </div>
      <div class="row-end"><button class="btn-text" id="srs-remove" type="button">🗑 이 ${nounFor(current.kind)} 빼기</button></div>
    </div>`;
  $("#srs-recall").addEventListener("click", () => showChoice(true));
  $("#srs-forgot").addEventListener("click", () => showChoice(false));
  $("#srs-remove").addEventListener("click", removeCurrent);
}

function removeCurrent() {
  removeItem(current);
  toast("복습에서 뺐어요.");
  nextQuestion();
}

function meaningHTML(item) {
  return `<div class="word-meaning">${esc(item.meaning)}</div>${
    item.example ? `<p class="example">예시: ${esc(item.example)}</p>` : ""
  }`;
}

// 2단계: 뜻을 보여주고, 예문 만들기(선택)와 그냥 넘어가기 중 고른다.
function showChoice(remembered) {
  recalled = remembered;
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">${nounFor(current.kind)} 확인</span>
      <h3 class="expr-word">${esc(current.term)}</h3>
      ${meaningHTML(current)}
      <div class="row-rate">
        <button class="btn-secondary" id="srs-plain-next" type="button">⏭ 예문 없이 넘어가기</button>
        <button class="btn-primary" id="srs-produce" type="button">✍️ 예문 만들기</button>
      </div>
    </div>`;
  $("#srs-produce").addEventListener("click", startProduce);
  $("#srs-plain-next").addEventListener("click", () => finish(recalled));
}

// 예문 만들기(선택): 표현/단어로 문장을 만들면 AI가 첨삭한다.
function startProduce() {
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">이 ${nounFor(current.kind)}로 예문 만들기</span>
      <h3 class="expr-word">${esc(current.term)}</h3>
    </div>
    <form id="srs-form">
      <textarea id="srs-input" rows="3" placeholder="이 ${nounFor(current.kind)}로 예문을 만들어 보세요..."></textarea>
      <div class="row-end">
        <button class="btn-primary" type="submit">채점 받기</button>
      </div>
    </form>
    <div id="srs-result"></div>`;
  $("#srs-input").focus();
  $("#srs-form").addEventListener("submit", onSubmit);
}

async function grade(sentence) {
  return chatJSON({
    system: `You review a Korean learner's example sentence using the target ${current.kind === "word" ? "word" : "expression"} "${current.term}".
- corrections: grammar errors and unnatural phrasings, reasons in Korean.
- natural_version: how a native speaker would write the same idea using the ${current.kind === "word" ? "word" : "expression"}.
- comment: one or two sentences in Korean on whether it was used correctly.
- grades: grade each rubric component S/A/B/C/F (S excellent, F poor): naturalness (natural use of the target ${current.kind === "word" ? "word" : "expression"}), grammar, comprehension (clarity of sentence structure).`,
    messages: [{ role: "user", content: `Learner's sentence: "${sentence}"` }],
    schema: REVIEW_SCHEMA,
  });
}

async function onSubmit(ev) {
  ev.preventDefault();
  const sentence = $("#srs-input").value.trim();
  if (!sentence) return toast("예문을 먼저 작성해 주세요.");
  const btn = ev.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "채점 중...";
  try {
    const result = await grade(sentence);
    const score = scoreDetail("expression", result.grades).total;
    $("#srs-input").disabled = true;
    btn.classList.add("hidden");

    // 채점(피드백)만 보여 주고, 다음 복습 시점은 아래 버튼(최종 자가판정)이 정한다.
    const decision = recalled
      ? `<div class="row-end">
           <button class="btn-secondary" id="srs-wrong" type="button">😵 잘못 생각했어요</button>
           <button class="btn-primary" id="srs-next" type="button">다음 →</button>
         </div>`
      : `<div class="row-end"><button class="btn-primary" id="srs-next" type="button">다음 →</button></div>`;

    $("#srs-result").innerHTML = `
      <div class="feedback ${result.corrections.length ? "" : "good"}">
        <div class="fb-title">📝 첨삭</div>
        ${scoreBreakdownHTML("expression", result.grades)}
        ${correctionsHTML(result.corrections)}
        <div>💬 원어민이라면: <span class="fixed">${esc(result.natural_version)}</span></div>
        <div class="reason mt-6">${esc(result.comment)}</div>
      </div>
      ${decision}`;

    // recalled + '다음' → 정말 기억함(정답). recalled + '잘못 생각했어요' 또는 까먹음 → 처음으로.
    $("#srs-next").addEventListener("click", () => finish(recalled, score));
    const wrongBtn = $("#srs-wrong");
    if (wrongBtn) wrongBtn.addEventListener("click", () => finish(false, score));
  } catch (e) {
    toast(e.message);
    btn.disabled = false;
    btn.textContent = "채점 받기";
  }
}

// 최종 자가판정으로 SRS를 반영하고 기록을 남긴 뒤 다음 문제로. score는 예문을 만들었을 때만 있다.
function finish(remembered, score) {
  const now = Date.now();
  const updated = review(current.raw, remembered, now);
  if (current.kind === "word") updateWord(updated);
  else updateCard(updated);
  appendRecord("quiz", { expression: current.term, correct: remembered, kind: current.kind, ...(score != null ? { score } : {}) });
  sessionTotal += 1;
  if (remembered) sessionRemembered += 1;
  else queue.push(wrap(updated, current.kind)); // 기억 못한 항목은 이번 세션에서 다시
  nextQuestion();
}

function renderSummary() {
  const rate = sessionTotal ? Math.round((sessionRemembered / sessionTotal) * 100) : 0;
  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🎉 복습 완료</h2>
      <p>${sessionTotal}개 중 ${sessionRemembered}개 기억했어요 (기억률 ${rate}%)</p>
      <button class="btn-secondary" id="srs-home">돌아가기</button>
    </div>`;
  $("#srs-home").addEventListener("click", renderHome);
}

export function render() {
  renderHome();
}
