// 복습 화면: 덱에 쌓인 표현을 망각곡선 간격에 따라 빈칸 문제로 복습한다. 채점은 100% 로컬(AI 미사용).
import { review, dueCards, INTERVALS } from "./scheduler.js";
import { buildQuiz, grade } from "./cloze.js";
import { getDeck, updateCard, appendRecord } from "../../shared/store.js";
import { $, esc, toast } from "../../shared/dom.js";

let queue = [];
let currentCard = null;
let currentQuiz = null;
let sessionTotal = 0;
let sessionCorrect = 0;

function dueLabel(card, now) {
  if (card.due <= now) return `<span class="due-now">지금</span>`;
  const days = Math.ceil((card.due - now) / (24 * 60 * 60 * 1000));
  return `${days}일 후`;
}

function renderHome() {
  const now = Date.now();
  const deck = getDeck();
  const due = dueCards(deck, now);
  const deckRows = deck
    .slice()
    .sort((a, b) => a.due - b.due)
    .map(
      (c) => `<div class="stat-row"><span><b>${esc(c.expression)}</b> <span class="reason">${esc(c.meaning)}</span></span><span>${dueLabel(c, now)}</span></div>`
    )
    .join("");

  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🔁 표현 복습</h2>
      <p>표현·글쓰기에서 배운 표현이 자동으로 쌓여요.<br/>
      망각곡선(${INTERVALS.slice(0, 4).join("→")}일…)에 맞춰 빈칸 문제로 복습해요. AI를 쓰지 않아 무료예요.</p>
      ${
        deck.length === 0
          ? `<p class="muted">아직 덱이 비어 있어요. 표현 공부나 글쓰기 첨삭을 하면 표현이 쌓여요.</p>`
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
  queue = dueCards(getDeck(), Date.now());
  sessionTotal = 0;
  sessionCorrect = 0;
  nextQuestion();
}

function nextQuestion() {
  currentCard = queue.shift() || null;
  if (!currentCard) return renderSummary();
  currentQuiz = buildQuiz(currentCard);
  const remaining = queue.length + 1;
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">${currentQuiz.type === "cloze" ? "빈칸 채우기" : "뜻 보고 떠올리기"} · 남은 문제 ${remaining}</span>
      <p class="question-text">${esc(currentQuiz.prompt)}</p>
      <p class="muted">힌트: ${esc(currentQuiz.hint)}</p>
    </div>
    <form id="srs-form">
      <input id="srs-input" type="text" class="srs-answer" placeholder="빈칸에 들어갈 표현을 입력하세요..." autocomplete="off" />
      <div class="row-end"><button class="btn-primary" type="submit">확인</button></div>
    </form>
    <div id="srs-result"></div>`;
  $("#srs-input").focus();
  $("#srs-form").addEventListener("submit", onSubmit);
}

function onSubmit(ev) {
  ev.preventDefault();
  const answer = $("#srs-input").value.trim();
  if (!answer) return toast("답을 입력해 주세요.");
  const correct = grade(answer, currentQuiz.answer);
  const now = Date.now();
  const updated = review(currentCard, correct, now);
  updateCard(updated);
  appendRecord("quiz", { expression: currentCard.expression, correct });
  sessionTotal += 1;
  if (correct) sessionCorrect += 1;

  $("#srs-input").disabled = true;
  $("#srs-form").querySelector("button").classList.add("hidden");
  $("#srs-result").innerHTML = `
    <div class="feedback ${correct ? "good" : ""}">
      <div class="fb-title">${correct ? "✅ 정답이에요!" : "❌ 아쉬워요."} 정답: <span class="fixed">${esc(currentQuiz.answer)}</span></div>
      ${currentCard.example ? `<div class="reason">예문: ${esc(currentCard.example)}</div>` : ""}
      <div class="reason">다음 복습: ${correct ? `${updated.interval}일 후` : "10분 후 (이번 세션에서 다시)"} </div>
    </div>
    <div class="row-end"><button class="btn-secondary" id="srs-next">다음 →</button></div>`;
  if (!correct) queue.push(updated); // 오답 카드는 세션 뒤로 보내 재도전
  $("#srs-next").addEventListener("click", nextQuestion);
}

function renderSummary() {
  const rate = sessionTotal ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🎉 복습 완료</h2>
      <p>${sessionTotal}문제 중 ${sessionCorrect}문제 정답 (정답률 ${rate}%)</p>
      <button class="btn-secondary" id="srs-home">돌아가기</button>
    </div>`;
  $("#srs-home").addEventListener("click", renderHome);
}

export function render() {
  renderHome();
}
