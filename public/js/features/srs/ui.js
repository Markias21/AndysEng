// 복습 화면: 회화·글쓰기에서 배운 표현(deck) + 사전에서 담은 단어(words)를 한 큐에서 함께 복습한다.
//
// 하루 부담을 상한(신규/총량)으로 고정한다 — 표현이 쌓여도 오늘 할 양은 변하지 않고, 넘친 건 다음 날로 넘어간다.
//
// 흐름: 예문의 빈칸을 채워 표현을 직접 인출한다(quiz-ui.js). 예문 해석이 단서고,
//  막히면 [📖 뜻 알아보기]로 뜻을, [🔤 첫 글자 힌트]로 첫 글자를 볼 수 있다.
//  빈칸을 맞히면 간격 상승, 틀리거나 비우면 하락 — 다음 복습 시점은 이 정답 여부가 정한다.
//  채점 후에는 두 갈래: ✍️ 예문 만들기(AI 첨삭, produce-ui.js)이거나 ⏭ 다음.
// 놓친 항목은 세션 끝의 🔁 재도전 단계에서 다시 인출한다. 재도전은 그 자리에서 굳히기만 하고
// 다음 복습 시점을 바꾸지 않는다 — 같은 세션 안에서의 성공은 단기기억에서 나온 것이라 장기 파지의 증거가 아니다.
// AI 첨삭은 피드백 전용이고 간격에는 영향을 주지 않는다.
// 유저 레벨(±1) 밖의 표현 카드는 제외한다(단어 카드는 레벨 태그가 없어 항상 포함).
import { review, clearLeech, masteryLabel, INTERVALS } from "./scheduler.js";
import { wrap, allItems, todayPlan } from "./items.js";
import { renderProduce } from "./produce-ui.js";
import { renderQuiz } from "./quiz-ui.js";
import { openHistory } from "./history-ui.js";
import { nounFor, withParticle, dueLabel, leechBadge } from "./labels.js";
import { updateCard, removeCard, updateWord, removeWord, appendRecord, getProfile } from "../../shared/store.js";
import { $, esc, toast, nonLiteralBadge } from "../../shared/dom.js";

const RETRY_ALLOWANCE = 2; // 놓친 카드를 재도전에서 다시 보여줄 최대 횟수(본 문제 1회 + 재도전 2회)

let queue = [];
let retryQueue = []; // 이번 세션에서 놓친 항목 (세션 말 재도전용)
let current = null; // items.js의 wrap 결과 + 재도전 단계에서는 retryLeft
let inRetry = false;
let sessionTotal = 0;
let sessionCorrect = 0;

function removeItem(item) {
  if (item.kind === "word") removeWord(item.raw.id);
  else removeCard(item.raw.id);
  retryQueue = retryQueue.filter((it) => it.raw.id !== item.raw.id);
}

function saveItem(item, updated) {
  if (item.kind === "word") updateWord(updated);
  else updateCard(updated);
}

function renderHome() {
  const now = Date.now();
  const level = getProfile().level;
  const items = allItems().sort((a, b) => a.raw.due - b.raw.due);
  const { plan, totalDone, newDone, newLimit, reviewLimit, waiting } = todayPlan();
  const rows = items
    .map(
      (it) =>
        `<div class="stat-row"><span>${it.kind === "word" ? "📖" : "🔁"} <b>${esc(it.term)}</b>${it.level ? ` <span class="cefr">${esc(it.level)}</span>` : ""}${nonLiteralBadge(it.nonLiteral)}${leechBadge(it.raw)} <span class="mastery">${masteryLabel(it.raw)}</span></span><span class="row-actions"><button class="btn-text card-history" data-id="${it.raw.id}" data-kind="${it.kind}" title="복습 기록 보기">📜</button>${dueLabel(it.raw, now)}<button class="btn-text card-remove" data-id="${it.raw.id}" data-kind="${it.kind}" title="복습에서 빼기">🗑</button></span></div>`
    )
    .join("");

  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🔁 복습</h2>
      <p>회화·글쓰기에서 배운 표현과 📖 사전으로 담은 단어가 여기 함께 쌓여요.<br/>
      예문 속 빈칸을 채워 직접 떠올리고, 원하면 예문을 만들어 AI 첨삭도 받아요(선택). 망각곡선(${INTERVALS.slice(0, 4).join("→")}일…)에 맞춰 복습합니다.</p>
      <div class="srs-progress">오늘 복습 <b>${totalDone}/${reviewLimit}</b> · 신규 <b>${newDone}/${newLimit}</b>${waiting > 0 ? ` · 대기 중 ${waiting}개` : ""}</div>
      <p class="muted small">표현이 아무리 쌓여도 하루에 하는 양은 <b>${reviewLimit}개</b>로 고정돼요. 넘친 건 다음 날로 넘어가니 밀렸다고 걱정하지 않아도 됩니다. 표현 카드는 내 레벨 <b>${esc(level)}</b> 근처(±1)만 나와요. 상한과 레벨은 ⚙️ 설정에서 바꿀 수 있어요.</p>
      ${
        items.length === 0
          ? `<p class="muted">아직 쌓인 게 없어요. 회화·글쓰기를 하거나 📖 사전에서 단어를 담아 보세요.</p>`
          : plan.length === 0
            ? waiting > 0
              ? `<p class="muted">오늘 몫을 다 했어요. 남은 ${waiting}개는 내일 이어서 해요.</p>`
              : `<p class="muted">지금 복습할 게 없어요. 전체 ${items.length}개가 예정대로 기다리고 있어요.</p>`
            : `<button class="btn-primary" id="srs-start">복습 시작 (${plan.length}개)</button>`
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
  $("#srs-content")
    .querySelectorAll(".card-history")
    .forEach((b) =>
      b.addEventListener("click", () => {
        const item = items.find((it) => it.raw.id === b.dataset.id && it.kind === b.dataset.kind);
        if (item) openHistory(item);
      })
    );
}

function startSession() {
  queue = todayPlan().plan;
  retryQueue = [];
  inRetry = false;
  sessionTotal = 0;
  sessionCorrect = 0;
  nextQuestion();
}

function nextQuestion() {
  current = queue.shift() || null;
  if (!current) return retryQueue.length ? renderRetryIntro() : renderSummary();
  const item = current;
  renderQuiz(
    item,
    { remaining: queue.length + 1, inRetry },
    {
      onNext: (correct) => (inRetry ? afterRetry(correct, item) : finish(correct)),
      onProduce: (correct) => renderProduce(item, (score) => finish(correct, score)),
      onRemove: removeCurrent,
    }
  );
}

function removeCurrent() {
  removeItem(current);
  toast("복습에서 뺐어요.");
  nextQuestion();
}

// 재도전에서 또 놓쳤으면 남은 횟수만큼 큐 뒤로 보낸다. SRS 간격은 이미 정해졌으므로 바꾸지 않는다.
function afterRetry(correct, item) {
  if (!correct && item.retryLeft > 1) queue.push({ ...item, retryLeft: item.retryLeft - 1 });
  nextQuestion();
}

// 빈칸 정답 여부로 SRS를 반영하고 기록을 남긴 뒤 다음 문제로. score는 예문을 만들었을 때만 있다.
function finish(remembered, score) {
  const wasNew = !current.raw.reps; // 하루 신규 상한을 세는 기준
  const wasLeech = !!current.raw.leech;
  const updated = review(current.raw, remembered, Date.now());
  saveItem(current, updated);
  appendRecord("quiz", {
    id: current.raw.id,
    expression: current.term,
    correct: remembered,
    kind: current.kind,
    isNew: wasNew,
    ...(score != null ? { score } : {}),
  });
  sessionTotal += 1;
  if (remembered) sessionCorrect += 1;
  else retryQueue.push({ ...wrap(updated, current.kind), retryLeft: RETRY_ALLOWANCE });

  // 방금 leech가 켜졌을 때만 한 번 물어본다(계속 보기로 했다면 다시 8회 뒤에).
  if (updated.leech && !wasLeech) return renderLeechPrompt(current, updated);
  nextQuestion();
}

// 아무리 해도 안 외워지는 항목: 몰래 없애지 않고 유저에게 판단을 맡긴다.
function renderLeechPrompt(item, updated) {
  const noun = nounFor(item.kind);
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">⚠️ 잘 안 외워지는 ${noun}</span>
      <h3 class="expr-word">${esc(item.term)}</h3>
      <p class="reason">이 ${withParticle(noun, "을", "를")} ${updated.lapses}번이나 놓쳤어요. 이런 항목은 대개 지금 레벨에 안 맞거나, 예문이 와닿지 않는 경우예요. 계속 붙잡고 있기보다 빼는 편이 나을 수도 있어요.</p>
      <div class="row-rate">
        <button class="btn-secondary" id="srs-leech-keep" type="button">계속 볼래요</button>
        <button class="btn-primary" id="srs-leech-drop" type="button">🗑 복습에서 빼기</button>
      </div>
    </div>`;
  $("#srs-leech-drop").addEventListener("click", () => {
    removeItem(item);
    toast("복습에서 뺐어요.");
    nextQuestion();
  });
  $("#srs-leech-keep").addEventListener("click", () => {
    saveItem(item, clearLeech(updated));
    nextQuestion();
  });
}

// 세션 말 재도전: 방금 놓친 것만 다시 인출해 굳힌다.
function renderRetryIntro() {
  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🔁 재도전 ${retryQueue.length}개</h2>
      <p>방금 놓친 것만 다시 볼게요. 여기서 맞혀도 다음 복습 날짜는 바뀌지 않아요 — 지금 한 번 더 떠올려 머리에 굳히는 단계예요.</p>
      <div class="row-rate">
        <button class="btn-secondary" id="srs-retry-skip" type="button">오늘은 여기까지</button>
        <button class="btn-primary" id="srs-retry-start" type="button">재도전 시작</button>
      </div>
    </div>`;
  $("#srs-retry-start").addEventListener("click", () => {
    inRetry = true;
    queue = retryQueue;
    retryQueue = [];
    nextQuestion();
  });
  $("#srs-retry-skip").addEventListener("click", renderSummary);
}

/** 정답률에 따른 상한 조정 힌트. 너무 어려우면 학습이 안 되고, 너무 쉬우면 시간이 아깝다. */
function rateHint(rate) {
  if (rate < 70) return `<p class="reason">정답률이 낮아요. ⚙️ 설정에서 하루 학습량을 줄이면 이미 배운 걸 굳히는 데 집중할 수 있어요.</p>`;
  if (rate > 95) return `<p class="reason">여유가 있어요. ⚙️ 설정에서 하루 학습량을 늘려도 좋겠어요.</p>`;
  return "";
}

function renderSummary() {
  const rate = sessionTotal ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🎉 복습 완료</h2>
      <p>${sessionTotal}개 중 ${sessionCorrect}개 맞혔어요 (정답률 ${rate}%)</p>
      ${sessionTotal ? rateHint(rate) : ""}
      <button class="btn-secondary" id="srs-home">돌아가기</button>
    </div>`;
  $("#srs-home").addEventListener("click", renderHome);
}

export function render() {
  renderHome();
}
