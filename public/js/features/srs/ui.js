// 복습 화면: 회화·글쓰기에서 배운 표현(deck) + 사전에서 담은 단어(words)를 한 큐에서 함께 복습한다.
//
// 하루 부담을 상한(신규/총량)으로 고정한다 — 표현이 쌓여도 오늘 할 양은 변하지 않고, 넘친 건 다음 날로 넘어간다.
//
// 흐름: 표현/단어만 보여 주고 [🙂 기억나요 / 😵 까먹었어요]로 먼저 자가평가한다.
//  그 다음 뜻+예시를 보여주고 두 갈래로 나뉜다:
//   - ✍️ 예문 만들기: AI가 첨삭한다(produce-ui.js). 기억나요였다면 [😵 잘못 생각했어요 / 다음 →]로
//     진짜 기억했는지 최종 확인한다('다음'=간격 상승, '잘못 생각했어요'/까먹었어요=간격 하락).
//   - ⏭ 예문 없이 넘어가기: 첨삭 없이 방금 한 자가평가를 그대로 다음 간격 결정에 쓴다.
// 놓친 항목은 세션 끝의 🔁 재도전 단계에서 다시 인출한다. 재도전은 그 자리에서 굳히기만 하고
// 다음 복습 시점을 바꾸지 않는다 — 같은 세션 안에서의 성공은 단기기억에서 나온 것이라 장기 파지의 증거가 아니다.
// AI 채점은 피드백 전용이고, 다음 복습 시점은 자가평가(+선택적 최종 확인)가 정한다.
// 유저 레벨(±1) 밖의 표현 카드는 제외한다(단어 카드는 레벨 태그가 없어 항상 포함).
import { review, clearLeech, masteryLabel, INTERVALS } from "./scheduler.js";
import { wrap, allItems, todayPlan } from "./items.js";
import { renderProduce } from "./produce-ui.js";
import { nounFor, withParticle, dueLabel, leechBadge, meaningHTML } from "./labels.js";
import { updateCard, removeCard, updateWord, removeWord, appendRecord, getProfile } from "../../shared/store.js";
import { $, esc, toast, nonLiteralBadge } from "../../shared/dom.js";

const RETRY_ALLOWANCE = 2; // 놓친 카드를 재도전에서 다시 보여줄 최대 횟수(본 문제 1회 + 재도전 2회)

let queue = [];
let retryQueue = []; // 이번 세션에서 놓친 항목 (세션 말 재도전용)
let current = null; // items.js의 wrap 결과 + 재도전 단계에서는 retryLeft
let recalled = false; // 이번 항목에서 '기억나요'를 눌렀는지
let inRetry = false;
let sessionTotal = 0;
let sessionRemembered = 0;

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
        `<div class="stat-row"><span>${it.kind === "word" ? "📖" : "🔁"} <b>${esc(it.term)}</b>${it.level ? ` <span class="cefr">${esc(it.level)}</span>` : ""}${nonLiteralBadge(it.nonLiteral)}${leechBadge(it.raw)} <span class="mastery">${masteryLabel(it.raw)}</span></span><span class="row-actions">${dueLabel(it.raw, now)}<button class="btn-text card-remove" data-id="${it.raw.id}" data-kind="${it.kind}" title="복습에서 빼기">🗑</button></span></div>`
    )
    .join("");

  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🔁 복습</h2>
      <p>회화·글쓰기에서 배운 표현과 📖 사전으로 담은 단어가 여기 함께 쌓여요.<br/>
      먼저 기억나는지 스스로 확인하고, 원하면 예문을 만들어 AI 첨삭도 받아요(선택). 망각곡선(${INTERVALS.slice(0, 4).join("→")}일…)에 맞춰 복습합니다.</p>
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
}

function startSession() {
  queue = todayPlan().plan;
  retryQueue = [];
  inRetry = false;
  sessionTotal = 0;
  sessionRemembered = 0;
  nextQuestion();
}

// 1단계: 표현/단어만 보여 주고 기억 여부를 먼저 묻는다.
function nextQuestion() {
  current = queue.shift() || null;
  if (!current) return retryQueue.length ? renderRetryIntro() : renderSummary();
  const remaining = queue.length + 1;
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">${inRetry ? "🔁 재도전" : `이 ${nounFor(current.kind)}, 기억나요?`} · 남은 항목 ${remaining}</span>
      <h3 class="expr-word">${esc(current.term)}</h3>
      ${current.kind === "word" && current.pos ? `<p class="dict-pos">${esc(current.pos)}</p>` : ""}
      <div class="row-rate">
        <button class="btn-secondary" id="srs-forgot" type="button">😵 ${inRetry ? "아직이요" : "까먹었어요"}</button>
        <button class="btn-primary" id="srs-recall" type="button">🙂 ${inRetry ? "기억났어요" : "기억나요"}</button>
      </div>
      ${inRetry ? "" : `<div class="row-end"><button class="btn-secondary btn-chip" id="srs-remove" type="button">🗑 이 ${nounFor(current.kind)} 빼기</button></div>`}
    </div>`;
  $("#srs-recall").addEventListener("click", () => showChoice(true));
  $("#srs-forgot").addEventListener("click", () => showChoice(false));
  const removeBtn = $("#srs-remove");
  if (removeBtn) removeBtn.addEventListener("click", removeCurrent);
}

function removeCurrent() {
  removeItem(current);
  toast("복습에서 뺐어요.");
  nextQuestion();
}

// 2단계: 뜻을 보여주고, 예문 만들기(선택)와 그냥 넘어가기 중 고른다.
function showChoice(remembered) {
  recalled = remembered;
  if (inRetry) return showRetryReveal(remembered);
  // 놓친 항목은 예문까지 만들어 산출(produce)하는 편이 훨씬 잘 남으므로 그쪽을 주 버튼으로 둔다.
  const produceFirst = !remembered;
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">${nounFor(current.kind)} 확인</span>
      <h3 class="expr-word">${esc(current.term)}</h3>
      ${meaningHTML(current)}
      ${produceFirst ? `<p class="reason">방금 놓친 ${withParticle(nounFor(current.kind), "은", "는")} 예문까지 만들어 보면 훨씬 오래 남아요.</p>` : ""}
      <div class="row-rate">
        <button class="${produceFirst ? "btn-secondary" : "btn-primary"}" id="srs-plain-next" type="button">⏭ 예문 없이 넘어가기</button>
        <button class="${produceFirst ? "btn-primary" : "btn-secondary"}" id="srs-produce" type="button">✍️ 내 이야기로 예문 만들기</button>
      </div>
    </div>`;
  $("#srs-produce").addEventListener("click", () => renderProduce(current, recalled, finish));
  $("#srs-plain-next").addEventListener("click", () => finish(recalled));
}

// 최종 자가판정으로 SRS를 반영하고 기록을 남긴 뒤 다음 문제로. score는 예문을 만들었을 때만 있다.
function finish(remembered, score) {
  const wasNew = !current.raw.reps; // 하루 신규 상한을 세는 기준
  const wasLeech = !!current.raw.leech;
  const updated = review(current.raw, remembered, Date.now());
  saveItem(current, updated);
  appendRecord("quiz", {
    expression: current.term,
    correct: remembered,
    kind: current.kind,
    isNew: wasNew,
    ...(score != null ? { score } : {}),
  });
  sessionTotal += 1;
  if (remembered) sessionRemembered += 1;
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

// 세션 말 재도전: 방금 놓친 것만 다시 인출해 굳힌다. SRS 간격은 이미 정해졌으므로 바꾸지 않는다.
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

// 재도전에서 뜻을 확인하고 넘어간다. 못 떠올렸으면 남은 횟수만큼 큐 뒤로 보낸다.
function showRetryReveal(remembered) {
  const again = !remembered && current.retryLeft > 1;
  const item = current;
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">🔁 재도전</span>
      <h3 class="expr-word">${esc(item.term)}</h3>
      ${meaningHTML(item)}
      ${again ? `<p class="reason">조금 뒤에 한 번 더 보여드릴게요.</p>` : ""}
      <div class="row-end"><button class="btn-primary" id="srs-retry-next" type="button">다음 →</button></div>
    </div>`;
  $("#srs-retry-next").addEventListener("click", () => {
    if (again) queue.push({ ...item, retryLeft: item.retryLeft - 1 });
    nextQuestion();
  });
}

/** 기억률에 따른 상한 조정 힌트. 너무 어려우면 학습이 안 되고, 너무 쉬우면 시간이 아깝다. */
function rateHint(rate) {
  if (rate < 70) return `<p class="reason">기억률이 낮아요. ⚙️ 설정에서 하루 학습량을 줄이면 이미 배운 걸 굳히는 데 집중할 수 있어요.</p>`;
  if (rate > 95) return `<p class="reason">여유가 있어요. ⚙️ 설정에서 하루 학습량을 늘려도 좋겠어요.</p>`;
  return "";
}

function renderSummary() {
  const rate = sessionTotal ? Math.round((sessionRemembered / sessionTotal) * 100) : 0;
  $("#srs-content").innerHTML = `
    <div class="card intro-card">
      <h2>🎉 복습 완료</h2>
      <p>${sessionTotal}개 중 ${sessionRemembered}개 기억했어요 (기억률 ${rate}%)</p>
      ${sessionTotal ? rateHint(rate) : ""}
      <button class="btn-secondary" id="srs-home">돌아가기</button>
    </div>`;
  $("#srs-home").addEventListener("click", renderHome);
}

export function render() {
  renderHome();
}
