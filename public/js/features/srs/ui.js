// 복습 화면: 회화·글쓰기에서 배운 표현을 망각곡선 간격에 따라 복습한다.
// 표현만 보여 주고 뜻은 숨긴다(원하면 버튼으로 공개). 유저가 그 표현으로 문장을 만들면
// AI가 표현 루브릭(자연스러움/문법/이해)으로 S~F 채점한다. 통과(REVIEW_PASS_SCORE 이상)면 간격이 오른다.
// 유저 레벨(±1) 밖의 표현은 이번 복습에서 제외한다.
import { review, dueCards, INTERVALS } from "./scheduler.js";
import { chatJSON } from "../../shared/claude.js";
import { getDeck, updateCard, appendRecord, getProfile } from "../../shared/store.js";
import { scoreDetail, reviewPassed } from "../../shared/scoring.js";
import { filterByLevel } from "../../shared/levels.js";
import { $, esc, toast, scoreBreakdownHTML, correctionsHTML } from "../../shared/dom.js";

let queue = [];
let currentCard = null;
let sessionTotal = 0;
let sessionPassed = 0;

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
        `<div class="stat-row"><span><b>${esc(c.expression)}</b>${c.level ? ` <span class="cefr">${esc(c.level)}</span>` : ""}</span><span>${dueLabel(c, now)}</span></div>`
    )
    .join("");

  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🔁 표현 복습</h2>
      <p>회화·글쓰기에서 배운 표현이 자동으로 쌓여요.<br/>
      표현만 보고 직접 문장을 만들면 AI가 채점해요. 망각곡선(${INTERVALS.slice(0, 4).join("→")}일…)에 맞춰 복습합니다.</p>
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
}

function startSession() {
  queue = filterByLevel(dueCards(getDeck(), Date.now()), getProfile().level, 1);
  sessionTotal = 0;
  sessionPassed = 0;
  nextQuestion();
}

function nextQuestion() {
  currentCard = queue.shift() || null;
  if (!currentCard) return renderSummary();
  const remaining = queue.length + 1;
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">표현으로 문장 만들기 · 남은 문제 ${remaining}</span>
      <h3 class="expr-word">${esc(currentCard.expression)}</h3>
      <button class="btn-text" id="srs-reveal" type="button">뜻 보기</button>
      <div id="srs-meaning" class="hidden"></div>
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
  $("#srs-reveal").addEventListener("click", revealMeaning);
  $("#srs-skip").addEventListener("click", skipQuestion);
  $("#srs-form").addEventListener("submit", onSubmit);
}

function revealMeaning() {
  const box = $("#srs-meaning");
  box.innerHTML = `<p class="muted">${esc(currentCard.meaning)}</p>${
    currentCard.example ? `<p class="example">예문: ${esc(currentCard.example)}</p>` : ""
  }`;
  box.classList.remove("hidden");
  $("#srs-reveal").classList.add("hidden");
}

// 건너뛰기: 채점하지 않고 카드를 세션 뒤로 보낸다(SRS 상태·기록 변화 없음).
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
    const detail = scoreDetail("expression", result.grades);
    const passed = reviewPassed(detail.total);
    const now = Date.now();
    const updated = review(currentCard, passed, now);
    updateCard(updated);
    appendRecord("quiz", { expression: currentCard.expression, correct: passed, score: detail.total });
    sessionTotal += 1;
    if (passed) sessionPassed += 1;

    $("#srs-input").disabled = true;
    $("#srs-skip").classList.add("hidden");
    btn.classList.add("hidden");
    revealMeaning();
    $("#srs-result").innerHTML = `
      <div class="feedback ${result.corrections.length ? "" : "good"}">
        <div class="fb-title">${passed ? "✅ 통과!" : "❌ 조금 더 연습해요."}</div>
        ${scoreBreakdownHTML("expression", result.grades)}
        ${correctionsHTML(result.corrections)}
        <div>💬 원어민이라면: <span class="fixed">${esc(result.natural_version)}</span></div>
        <div class="reason mt-6">${esc(result.comment)}</div>
        <div class="reason mt-6">다음 복습: ${passed ? `${updated.interval}일 후` : "10분 후 (이번 세션에서 다시)"}</div>
      </div>
      <div class="row-end"><button class="btn-secondary" id="srs-next">다음 →</button></div>`;
    if (!passed) queue.push(updated); // 미통과 카드는 세션 뒤로 보내 재도전
    $("#srs-next").addEventListener("click", nextQuestion);
  } catch (e) {
    toast(e.message);
    btn.disabled = false;
    btn.textContent = "채점 받기";
  }
}

function renderSummary() {
  const rate = sessionTotal ? Math.round((sessionPassed / sessionTotal) * 100) : 0;
  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🎉 복습 완료</h2>
      <p>${sessionTotal}문제 중 ${sessionPassed}문제 통과 (통과율 ${rate}%)</p>
      <button class="btn-secondary" id="srs-home">돌아가기</button>
    </div>`;
  $("#srs-home").addEventListener("click", renderHome);
}

export function render() {
  renderHome();
}
