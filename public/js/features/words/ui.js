// 단어장: 사전에서 담은 단어를 망각곡선 간격으로 복습하는 플래시카드.
// 단어+예문을 먼저 보여 주고(뜻은 숨김), 뜻 보기 → 자가평가(기억했어요/까먹었어요)로 간격을 정한다.
// AI 채점은 없다. 간격 스케줄링은 표현 복습과 같은 srs 도메인(scheduler.js)을 재사용한다.
import { review, dueCards, INTERVALS } from "../srs/scheduler.js";
import { getWords, updateWord, removeWord } from "../../shared/store.js";
import { $, esc, toast } from "../../shared/dom.js";

let queue = [];
let current = null;
let done = 0;

function dueLabel(card, now) {
  if (card.due <= now) return `<span class="due-now">지금</span>`;
  const days = Math.ceil((card.due - now) / (24 * 60 * 60 * 1000));
  return `${days}일 후`;
}

function renderHome() {
  const now = Date.now();
  const words = getWords();
  const due = dueCards(words, now);
  const rows = words
    .slice()
    .sort((a, b) => a.due - b.due)
    .map(
      (w) =>
        `<div class="stat-row"><span><b>${esc(w.word)}</b> <span class="muted small">${esc(w.meaning)}</span></span><span class="row-actions">${dueLabel(w, now)}<button class="btn-text word-remove" data-id="${w.id}" title="단어장에서 빼기">🗑</button></span></div>`
    )
    .join("");

  $("#words-content").innerHTML = `
    <div class="card intro-card">
      <h2>📖 단어장</h2>
      <p>회화·글쓰기 중 <b>📖 사전</b>으로 찾은 단어를 담아 두면 여기서 복습해요.<br/>
      단어와 예문을 보고 뜻을 떠올린 뒤, 스스로 평가하면 망각곡선(${INTERVALS.slice(0, 4).join("→")}일…)에 맞춰 다시 나와요.</p>
      ${
        words.length === 0
          ? `<p class="muted">아직 담은 단어가 없어요. 사전에서 ➕ 버튼으로 담아 보세요.</p>`
          : due.length === 0
            ? `<p class="muted">지금 복습할 단어가 없어요. 전체 ${words.length}개가 예정대로 기다리고 있어요.</p>`
            : `<button class="btn-primary" id="words-start">복습 시작 (${due.length}개)</button>`
      }
    </div>
    ${words.length ? `<details class="history"><summary>📚 내 단어장 (${words.length})</summary><div class="card">${rows}</div></details>` : ""}`;

  const startBtn = $("#words-start");
  if (startBtn) startBtn.addEventListener("click", startSession);
  $("#words-content")
    .querySelectorAll(".word-remove")
    .forEach((b) =>
      b.addEventListener("click", () => {
        removeWord(b.dataset.id);
        toast("단어장에서 뺐어요.");
        renderHome();
      })
    );
}

function startSession() {
  queue = dueCards(getWords(), Date.now());
  done = 0;
  nextCard();
}

function nextCard() {
  current = queue.shift() || null;
  if (!current) return renderSummary();
  const remaining = queue.length + 1;
  $("#words-content").innerHTML = `
    <div class="card">
      <span class="chip">뜻 떠올리기 · 남은 단어 ${remaining}</span>
      <h3 class="expr-word">${esc(current.word)}</h3>
      <p class="dict-pos">${esc(current.pos)}</p>
      <p class="example">${esc(current.example)}</p>
      <div id="words-reveal-box">
        <button class="btn-primary" id="words-reveal" type="button">뜻 보기</button>
      </div>
    </div>`;
  $("#words-reveal").addEventListener("click", reveal);
}

function reveal() {
  $("#words-reveal-box").innerHTML = `
    <div class="word-meaning">${esc(current.meaning)}</div>
    <div class="row-rate">
      <button class="btn-secondary" id="words-forgot" type="button">😵 까먹었어요</button>
      <button class="btn-primary" id="words-knew" type="button">🙂 기억했어요</button>
    </div>`;
  $("#words-knew").addEventListener("click", () => rate(true));
  $("#words-forgot").addEventListener("click", () => rate(false));
}

function rate(remembered) {
  updateWord(review(current, remembered, Date.now()));
  done += 1;
  if (!remembered) queue.push(review(current, false, Date.now())); // 까먹은 단어는 이번 세션에서 다시
  nextCard();
}

function renderSummary() {
  $("#words-content").innerHTML = `
    <div class="card intro-card">
      <h2>🎉 단어 복습 완료</h2>
      <p>${done}개 단어를 복습했어요.</p>
      <button class="btn-secondary" id="words-home">돌아가기</button>
    </div>`;
  $("#words-home").addEventListener("click", renderHome);
}

export function render() {
  renderHome();
}
