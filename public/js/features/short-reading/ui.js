// 문단 연습: 리딩 지문 속 문단 하나로 빠르게 훈련한다. 객관식은 로컬 채점(AI 0회),
// 재진술·요약은 AI가 짧게 첨삭한다(문단 1개짜리라 비용이 작아 확인창 없이 바로 호출).
// 🎧 3분 학습 탭 안에서 listening/ui.js가 이 모듈의 start()를 호출해 진입시킨다(같은 #listening-content를 공유).
import { $, esc, toast } from "../../shared/dom.js";
import { appendRecord, getProfile, getRecords } from "../../shared/store.js";
import { pickFresh } from "../../shared/pick.js";
import { CATEGORIES, categoryLabel, itemsOf } from "./items.js";
import { gradeProduce } from "./grading.js";

const ROOT = "#listening-content";
const RECENT = 20;

function recentItemIds() {
  return getRecords("shortReading")
    .slice(-RECENT)
    .map((r) => r.itemId);
}

function startCategory(categoryId, onBack) {
  const item = pickFresh(itemsOf(categoryId), recentItemIds(), (i) => i.id);
  if (!item) return toast("문항을 찾을 수 없습니다.");
  practiceItem(item, categoryId, onBack);
}

function renderCategories(onBack) {
  const root = $(ROOT);
  root.innerHTML = `
    <div class="room-toolbar"><button class="btn-text" id="sr-back-mode" type="button">← 3분 학습</button></div>
    <h2 class="page-title">⚡ 문단 연습</h2>
    <p class="muted">리딩 지문 속 문단 하나로 빠르게 훈련해요.<br/>객관식은 AI 없이 채점하고, 재진술·요약만 AI가 짧게 첨삭해요.</p>
    <div class="category-grid">
      ${CATEGORIES.map((c) => `<button class="btn-secondary category-btn" type="button" data-category="${c.id}">${esc(c.label)}</button>`).join("")}
      <button class="btn-secondary category-btn" type="button" id="sr-random">🎲 아무거나</button>
    </div>`;

  $("#sr-back-mode").addEventListener("click", onBack);
  root.querySelectorAll("[data-category]").forEach((btn) =>
    btn.addEventListener("click", () => startCategory(btn.dataset.category, onBack))
  );
  $("#sr-random").addEventListener("click", () => startCategory(null, onBack));
}

function mountMcq(root, item, onNext) {
  $("#sr-exercise").innerHTML = `
    <p class="question-text">${esc(item.question.stem)}</p>
    <form id="sr-form">
      <div class="mc-options">${item.question.options
        .map((o, j) => `<label class="mc-option"><input type="radio" name="sr-choice" value="${j}" /><span>${esc(o)}</span></label>`)
        .join("")}</div>
      <div class="row-end"><button class="btn-primary" type="submit">채점하기</button></div>
    </form>`;

  $("#sr-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const picked = root.querySelector('input[name="sr-choice"]:checked');
    const choice = picked ? Number(picked.value) : null;
    const correct = choice === item.question.answer;
    finishMcq(item, correct, onNext);
  });
}

function finishMcq(item, correct, onNext) {
  $("#sr-exercise").innerHTML = `
    <div class="card">
      <p class="${correct ? "cloze-ok" : "cloze-miss"}">${correct ? "✅ 정답이에요!" : `❌ 오답이에요. 정답: ${esc(item.question.options[item.question.answer])}`}</p>
      <p class="reason">${esc(item.question.explanation_ko)}</p>
    </div>
    <div class="row-end"><button class="btn-primary" id="sr-next" type="button">다음 문제 →</button></div>`;

  appendRecord("shortReading", { itemId: item.id, category: item.category, type: "mcq", correct });
  $("#sr-next").addEventListener("click", onNext);
}

function mountProduce(root, item, onNext) {
  const instruction = item.task === "summary" ? "이 문단을 1~2문장으로 영어로 요약해 보세요." : "이 문단을 다른 표현으로 영어로 재진술해 보세요.";
  $("#sr-exercise").innerHTML = `
    <form id="sr-form">
      <p class="small muted">${instruction}</p>
      <textarea id="sr-answer" rows="3" placeholder="In your own words..."></textarea>
      <div class="row-end"><button class="btn-primary" type="submit">제출하고 채점받기</button></div>
    </form>`;

  $("#sr-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const answer = $("#sr-answer").value.trim();
    if (!answer) return toast("답을 입력해 주세요.");
    const submitBtn = $("#sr-form").querySelector("button");
    submitBtn.disabled = true;
    try {
      const level = getProfile().level;
      const result = await gradeProduce({ paragraph: item.text, task: item.task, level, answer });
      finishProduce(item, result, onNext);
    } catch (e) {
      toast(e.message);
      submitBtn.disabled = false;
    }
  });
}

function finishProduce(item, result, onNext) {
  $("#sr-exercise").innerHTML = `
    <div class="card">
      <p class="${result.good ? "cloze-ok" : "cloze-miss"}">${result.good ? "✅ 잘했어요!" : "📝 조금 더 다듬어 볼까요"}</p>
      <p class="reason">${esc(result.feedback_ko)}</p>
      <p class="small muted">모범 답안: <i>${esc(result.model_answer)}</i></p>
    </div>
    <div class="row-end"><button class="btn-primary" id="sr-next" type="button">다음 문제 →</button></div>`;

  appendRecord("shortReading", { itemId: item.id, category: item.category, type: "produce", correct: result.good });
  $("#sr-next").addEventListener("click", onNext);
}

function practiceItem(item, categoryId, onBack) {
  const root = $(ROOT);
  root.innerHTML = `
    <div class="room-toolbar">
      <button class="btn-text" id="sr-back-cat" type="button">← 문단 연습</button>
      <span class="chip">${esc(categoryLabel(item.category))}</span>
    </div>
    <article class="card reading-passage">
      <p>${esc(item.text)}</p>
    </article>
    <div id="sr-exercise"></div>`;

  $("#sr-back-cat").addEventListener("click", () => renderCategories(onBack));
  const onNext = () => startCategory(categoryId, onBack);
  if (item.type === "mcq") mountMcq(root, item, onNext);
  else mountProduce(root, item, onNext);
}

/** ⚡ 문단 연습 진입점. onBack: 3분 학습 모드 카드로 돌아가기. */
export function start(onBack) {
  renderCategories(onBack);
}
