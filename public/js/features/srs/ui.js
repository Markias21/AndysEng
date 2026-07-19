// 복습 화면: 회화·글쓰기에서 배운 표현을 망각곡선 간격에 따라 복습한다.
//
// 흐름: 표현만 보여 주고 [🙂 기억나요 / 😵 까먹었어요]로 먼저 자가평가한다.
//  - 까먹었어요: 뜻+예시 예문을 보여준 뒤 그 표현으로 문장을 만든다. → 다음 복습은 처음으로.
//  - 기억나요: 뜻·예시를 숨긴 채 문장을 만든다. 채점 후 [😵 잘못 생각했어요 / 다음 →]로
//              진짜 기억했는지 최종 확인한다. '다음'이면 간격 상승, '잘못 생각했어요'면 처음으로.
// AI 채점은 피드백(첨삭·원어민 문장·등급)만 담당하고, 다음 복습 시점은 위 버튼이 정한다.
// 유저 레벨(±1) 밖의 표현은 이번 복습에서 제외한다.
import { review, dueCards, INTERVALS } from "./scheduler.js";
import { chatJSON } from "../../shared/claude.js";
import { getDeck, updateCard, removeCard, appendRecord, getProfile } from "../../shared/store.js";
import { scoreDetail } from "../../shared/scoring.js";
import { filterByLevel } from "../../shared/levels.js";
import { $, esc, toast, scoreBreakdownHTML, correctionsHTML } from "../../shared/dom.js";

let queue = [];
let currentCard = null;
let recalled = false; // 이번 카드에서 '기억나요'를 눌렀는지
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

function dueLabel(card, now) {
  if (card.due <= now) return `<span class="due-now">지금</span>`;
  const days = Math.ceil((card.due - now) / (24 * 60 * 60 * 1000));
  return `${days}일 후`;
}

function renderHome() {
  const now = Date.now();
  const level = getProfile().level;
  const deck = getDeck();
  const due = filterByLevel(dueCards(deck, now), level, 1);
  const deckRows = deck
    .slice()
    .sort((a, b) => a.due - b.due)
    .map(
      (c) =>
        `<div class="stat-row"><span><b>${esc(c.expression)}</b>${c.level ? ` <span class="cefr">${esc(c.level)}</span>` : ""}</span><span class="row-actions">${dueLabel(c, now)}<button class="btn-text card-remove" data-id="${c.id}" title="복습에서 빼기">🗑</button></span></div>`
    )
    .join("");

  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🔁 표현 복습</h2>
      <p>회화·글쓰기에서 배운 표현이 자동으로 쌓여요.<br/>
      먼저 기억나는지 스스로 확인하고, 표현으로 문장을 만들면 AI가 첨삭해요. 망각곡선(${INTERVALS.slice(0, 4).join("→")}일…)에 맞춰 복습합니다.</p>
      <p class="muted small">내 레벨 <b>${esc(level)}</b> 근처(±1)의 표현을 복습해요. 레벨은 상단에서 바꿀 수 있어요.</p>
      ${
        deck.length === 0
          ? `<p class="muted">아직 덱이 비어 있어요. 회화나 글쓰기를 하면 표현이 쌓여요.</p>`
          : due.length === 0
            ? `<p class="muted">지금 복습할 카드가 없어요. 전체 ${deck.length}개 표현이 예정대로 기다리고 있어요.</p>`
            : `<button class="btn-primary" id="srs-start">복습 시작 (${due.length}문제)</button>`
      }
    </div>
    ${deck.length ? `<details class="history"><summary>📚 내 표현 덱 (${deck.length})</summary><div class="card">${deckRows}</div></details>` : ""}`;

  const startBtn = $("#srs-start");
  if (startBtn) startBtn.addEventListener("click", startSession);
  $("#srs-content")
    .querySelectorAll(".card-remove")
    .forEach((b) =>
      b.addEventListener("click", () => {
        removeCard(b.dataset.id);
        toast("복습에서 뺐어요.");
        renderHome();
      })
    );
}

function startSession() {
  queue = filterByLevel(dueCards(getDeck(), Date.now()), getProfile().level, 1);
  sessionTotal = 0;
  sessionRemembered = 0;
  nextQuestion();
}

// 1단계: 표현만 보여 주고 기억 여부를 먼저 묻는다.
function nextQuestion() {
  currentCard = queue.shift() || null;
  if (!currentCard) return renderSummary();
  const remaining = queue.length + 1;
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">이 표현, 기억나요? · 남은 문제 ${remaining}</span>
      <h3 class="expr-word">${esc(currentCard.expression)}</h3>
      <div class="row-rate">
        <button class="btn-secondary" id="srs-forgot" type="button">😵 까먹었어요</button>
        <button class="btn-primary" id="srs-recall" type="button">🙂 기억나요</button>
      </div>
      <div class="row-end"><button class="btn-text" id="srs-remove" type="button">🗑 이 표현 빼기</button></div>
    </div>`;
  $("#srs-recall").addEventListener("click", () => startProduce(true));
  $("#srs-forgot").addEventListener("click", () => startProduce(false));
  $("#srs-remove").addEventListener("click", removeCurrent);
}

function removeCurrent() {
  removeCard(currentCard.id);
  toast("복습에서 뺐어요.");
  nextQuestion();
}

function meaningHTML(card) {
  return `<div class="word-meaning">${esc(card.meaning)}</div>${
    card.example ? `<p class="example">예시: ${esc(card.example)}</p>` : ""
  }`;
}

// 2단계: 표현으로 문장 만들기. 까먹었으면 뜻+예시를 먼저 공개한다.
function startProduce(remembered) {
  recalled = remembered;
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">${remembered ? "기억한 표현으로 문장 만들기" : "표현으로 문장 만들기"}</span>
      <h3 class="expr-word">${esc(currentCard.expression)}</h3>
      ${remembered ? "" : meaningHTML(currentCard)}
    </div>
    <form id="srs-form">
      <textarea id="srs-input" rows="3" placeholder="이 표현으로 예문을 만들어 보세요..."></textarea>
      <div class="row-end">
        <button class="btn-text" id="srs-skip" type="button">건너뛰기 →</button>
        <button class="btn-primary" type="submit">채점 받기</button>
      </div>
    </form>
    <div id="srs-result"></div>`;
  $("#srs-input").focus();
  $("#srs-skip").addEventListener("click", skipQuestion);
  $("#srs-form").addEventListener("submit", onSubmit);
}

// 건너뛰기: 채점·SRS 변화 없이 카드를 세션 뒤로 보낸다.
function skipQuestion() {
  if (currentCard) queue.push(currentCard);
  nextQuestion();
}

async function grade(sentence) {
  return chatJSON({
    system: `You review a Korean learner's example sentence using the target expression "${currentCard.expression}".
- corrections: grammar errors and unnatural phrasings, reasons in Korean.
- natural_version: how a native speaker would write the same idea using the expression.
- comment: one or two sentences in Korean on whether the expression was used correctly.
- grades: grade each rubric component S/A/B/C/F (S excellent, F poor): naturalness (natural use of the target expression), grammar, comprehension (clarity of sentence structure).`,
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
    $("#srs-skip").classList.add("hidden");
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
        ${meaningHTML(currentCard)}
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

// 최종 자가판정으로 SRS를 반영하고 기록을 남긴 뒤 다음 문제로.
function finish(remembered, score) {
  const now = Date.now();
  const updated = review(currentCard, remembered, now);
  updateCard(updated);
  appendRecord("quiz", { expression: currentCard.expression, correct: remembered, score });
  sessionTotal += 1;
  if (remembered) sessionRemembered += 1;
  else queue.push(updated); // 기억 못한 카드는 이번 세션에서 다시
  nextQuestion();
}

function renderSummary() {
  const rate = sessionTotal ? Math.round((sessionRemembered / sessionTotal) * 100) : 0;
  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🎉 복습 완료</h2>
      <p>${sessionTotal}문제 중 ${sessionRemembered}문제 기억했어요 (기억률 ${rate}%)</p>
      <button class="btn-secondary" id="srs-home">돌아가기</button>
    </div>`;
  $("#srs-home").addEventListener("click", renderHome);
}

export function render() {
  renderHome();
}
