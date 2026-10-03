// 글쓰기 공부: 로컬 질문 제시 → 유저가 답 작성 → 문법 첨삭 + 교정문 + 원어민 답안 + 표현 제시.
// 두 유형을 다룬다: 토론형(discussion, 3~4문장 논설)과 이메일(email, 토플 2026 Write an Email).
// 질문·상황은 로컬 데이터에서 뽑아 토큰을 아끼고, AI 호출은 첨삭에만 쓴다.
import { addRewrites, getProfile, getRecords } from "../../shared/store.js";
import { pickFresh, sampleN } from "../../shared/pick.js";
import { WRITING_TIPS } from "../../shared/levels.js";
import { autoSaveRecord } from "../../shared/autosave.js";
import { takeTranslatorUses } from "../../shared/translate.js";
import { toSeoulDate } from "../../shared/date.js";
import { writingPrompts } from "./prompts.js";
import { emailPrompts } from "./email-prompts.js";
import { structureTemplateHTML, structureExpressions } from "./structure.js";
import { startQna, resetQna, askQna, qnaLogHTML } from "./qna.js";
import { mountCloze } from "./cloze-ui.js";
import { reviewDiscussion, reviewEmail } from "./review.js";
import { feedbackHTML, gapSolutionsHTML } from "./feedback-ui.js";
import { scheduleRewrites } from "./rewrite.js";
import { renderRewriteList, todaysRewrites } from "./rewrite-ui.js";
import { extractGaps } from "./gaps.js";
import { attachTypingTimer } from "../../shared/typing-timer.js";
import { $, esc, toast, rubricGuideHTML, expressionAddHTML, wireExpressionAdds } from "../../shared/dom.js";

const MODES = [
  { id: "discussion", label: "💬 토론형" },
  { id: "email", label: "✉️ 이메일" },
];

// 이메일은 CEFR 레벨보다 과제(3개 항목·분량)가 목표를 정하므로 고정 안내를 쓴다.
const EMAIL_TIP = "요청된 3개 항목을 모두 다루면서 100~150단어, 공손한 어조로 써 보세요.";

// 구조 제시 패널에서 한 번에 보여 줄 표현 개수.
const STRUCTURE_EXPR_COUNT = 5;

// 최근 이 개수만큼의 질문/이메일 상황은 다시 나오지 않게 피한다.
const RECENT_PROMPTS = 20;

let currentMode = "discussion";
let currentEmailPrompt = null;
let currentQuestion = "";
let typingTimer = null;

// 다시 쓰기는 **일부러** 같은 질문을 다시 쓰는 것이므로 "최근 쓴 질문" 회피에서 뺀다.
// 빼지 않으면 새 질문 풀이 좁아지고 자매 질문까지 회피 대상이 된다.
function recentQuestions() {
  return getRecords("writing")
    .filter((r) => !r.rewriteOf && (r.mode || "discussion") === "discussion")
    .slice(-RECENT_PROMPTS)
    .map((r) => r.question);
}

function recentEmailIds() {
  return getRecords("writing")
    .filter((r) => !r.rewriteOf && r.mode === "email")
    .slice(-RECENT_PROMPTS)
    .map((r) => r.promptId);
}

const GAP_TIP = "막히면 번역기 대신 (한국어)로 표시하고 넘어가세요 — 감점 없이 그 자리의 표현을 알려드려요.";

/** 입력창 아래에 "막힌 곳 N개 표시됨"을 보여 준다. */
function updateGapCount() {
  const el = $("#writing-gap-count");
  const gaps = extractGaps($("#writing-input").value);
  el.textContent = gaps.length ? `🧩 막힌 곳 ${gaps.length}개 표시됨` : "";
  el.classList.toggle("hidden", gaps.length === 0);
}

function showTip() {
  const el = $("#writing-tip");
  if (currentMode === "email") {
    el.innerHTML = `<b>이메일 목표:</b> ${esc(EMAIL_TIP)}`;
  } else {
    const level = getProfile().level;
    el.innerHTML = `<b>${esc(level)} 목표:</b> ${esc(WRITING_TIPS[level] || WRITING_TIPS.B1)}`;
  }
  el.innerHTML += `<br/><span class="reason">${esc(GAP_TIP)}</span>`;
}

function renderQuestionCard() {
  $("#writing-structure-btn").classList.toggle("hidden", currentMode !== "discussion");
  $("#writing-rubric").innerHTML = rubricGuideHTML(currentMode === "email" ? "email" : "writing");
  if (currentMode === "email") {
    const p = currentEmailPrompt;
    $("#writing-question").textContent = p.situation;
    const recipient = $("#writing-recipient");
    recipient.textContent = `받는 사람: ${p.recipient}`;
    recipient.classList.remove("hidden");
    const bullets = $("#writing-bullets");
    bullets.innerHTML = p.bullets.map((b) => `<li>${esc(b)}</li>`).join("");
    bullets.classList.remove("hidden");
  } else {
    $("#writing-question").textContent = currentQuestion;
    $("#writing-recipient").classList.add("hidden");
    $("#writing-bullets").classList.add("hidden");
  }
  const input = $("#writing-input");
  input.placeholder = currentMode === "email"
    ? "제목·인사말부터 맺음말까지, 이메일 전체를 써 보세요..."
    : "3~4문장으로 자유롭게 써 보세요...";
  input.rows = currentMode === "email" ? 10 : 5;
  showTip();
}

function newQuestion() {
  takeTranslatorUses("writing"); // 이전 질문에서 남은 번역기 사용 기록은 새 질문으로 넘기지 않는다.
  resetQna();
  if (currentMode === "email") {
    const p = pickFresh(emailPrompts, recentEmailIds(), (e) => e.id);
    if (!p) return toast("이메일 문제를 불러오지 못했습니다.");
    currentEmailPrompt = p;
  } else {
    const question = pickFresh(writingPrompts, recentQuestions());
    if (!question) return toast("글쓰기 질문을 불러오지 못했습니다.");
    currentQuestion = question;
    currentEmailPrompt = null;
  }
  renderQuestionCard();
  typingTimer.reset();
  $("#writing-input").value = "";
  $("#writing-result").innerHTML = "";
  $("#writing-intro").classList.add("hidden");
  $("#writing-rewrite").classList.add("hidden");
  $("#writing-room").classList.remove("hidden");
  updateGapCount();
}

/**
 * 자매 질문: 같은 유형의 다른 질문. **AI를 쓰지 않는다** — 유저가 다시 쓰기를 할지 모르는 상태에서
 * 모든 첨삭에 출력 토큰을 더하지 않기 위함이다(ADR 2026-07-18 "미리 가질 수 있는 데이터는 로컬에").
 */
function pickSister(mode, used) {
  if (mode === "email") {
    const current = emailPrompts.find((p) => p.id === used);
    const pool = emailPrompts.filter((p) => p.id !== used && (!current || p.category === current.category));
    const picked = pickFresh(pool, recentEmailIds(), (e) => e.id);
    return picked ? { text: picked.situation, promptId: picked.id } : null;
  }
  const picked = pickFresh(writingPrompts.filter((q) => q !== used), recentQuestions());
  return picked ? { text: picked } : null;
}

function startMode(mode) {
  currentMode = mode;
  newQuestion();
}

/** 🔁 다시 쓰기 목록 화면. 그리는 일은 rewrite-ui.js가 한다(다시 쓰기 흐름 전체를 거기서 소유). */
function showRewriteList() {
  $("#writing-structure").classList.add("hidden");
  $("#writing-room").classList.add("hidden");
  $("#writing-intro").classList.add("hidden");
  $("#writing-rewrite").classList.remove("hidden");
  renderRewriteList($("#writing-rewrite"), backToModes);
}

function backToModes() {
  $("#writing-structure").classList.add("hidden");
  $("#writing-room").classList.add("hidden");
  $("#writing-rewrite").classList.add("hidden");
  $("#writing-intro").classList.remove("hidden");
  renderModes(); // 다시 쓰기를 끝내고 돌아오면 "오늘 N개"가 줄어 있어야 한다
}

function renderModes() {
  const grid = $("#writing-modes");
  const { today, overflow } = todaysRewrites();
  const rewriteLabel = today.length ? `🔁 다시 쓰기 (오늘 ${today.length}개)` : "🔁 다시 쓰기";
  grid.innerHTML =
    MODES.map((m) => `<button class="btn-secondary category-btn" type="button" data-mode="${m.id}">${esc(m.label)}</button>`).join("") +
    `<button class="btn-secondary category-btn${today.length ? "" : " category-dim"}" type="button" data-rewrite="list">${esc(rewriteLabel)}</button>`;
  grid.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => startMode(b.dataset.mode)));
  grid.querySelector("[data-rewrite]").addEventListener("click", showRewriteList);
  const note = $("#writing-rewrite-note");
  note.textContent = overflow > 0 ? `대기 중 ${overflow}개는 내일 이어서 할 수 있어요.` : "";
  note.classList.toggle("hidden", overflow === 0);
}

function renderStructureExpressions() {
  const picked = sampleN(structureExpressions, STRUCTURE_EXPR_COUNT);
  const el = $("#structure-exprs");
  el.innerHTML = expressionAddHTML(picked);
  wireExpressionAdds(el, picked, "writing");
}

function toggleStructure() {
  const panel = $("#writing-structure");
  const opening = panel.classList.contains("hidden");
  panel.classList.toggle("hidden");
  if (opening) {
    $("#structure-template").innerHTML = structureTemplateHTML;
    renderStructureExpressions();
  }
}

/**
 * 🎯 토플 허브·🏠 오늘에서 들어올 때 호출된다(router.js).
 * mode가 있으면 그 유형으로 바로 시작하고, 없으면 아무것도 하지 않는다 —
 * 작성 중인 초안을 모드 선택 화면으로 되돌려 날리지 않기 위함이다.
 */
export function render(mode) {
  if (mode) startMode(mode);
}

export function init() {
  renderModes();
  typingTimer = attachTypingTimer([$("#writing-input")], [$("#writing-timer")]);
  $("#writing-structure-btn").addEventListener("click", toggleStructure);
  $("#structure-refresh").addEventListener("click", renderStructureExpressions);
  $("#writing-mode-btn").addEventListener("click", backToModes);
  $("#writing-reroll").addEventListener("click", newQuestion);
  $("#writing-input").addEventListener("input", updateGapCount);

  $("#writing-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const answer = $("#writing-input").value.trim();
    if (!answer) return toast("답안을 먼저 작성해 주세요.");
    typingTimer.stop();
    const btn = ev.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = "첨삭 중...";
    try {
      const mode = currentMode;
      const questionText = mode === "email" ? currentEmailPrompt.situation : currentQuestion;
      const r = mode === "email" ? await reviewEmail(currentEmailPrompt, answer) : await reviewDiscussion(questionText, answer);
      startQna({ question: questionText, answer, feedback: r });
      const result = $("#writing-result");
      // 원어민 문장을 먼저 인출해 보게 하고, 그 뒤에야 첨삭 전체를 연다.
      // (정답이 corrections/corrected_answer로 새는 것을 막고, 모범 답안을 그냥 넘기지 않게 한다)
      result.innerHTML = `
        <div class="result-section" id="writing-cloze"></div>
        <div class="result-section hidden" id="writing-feedback-rest">${feedbackHTML(r, mode)}</div>`;
      mountCloze($("#writing-cloze"), r, (missed) => {
        $("#writing-feedback-rest").classList.remove("hidden");
        const exprs = $("#writing-exprs");
        exprs.innerHTML = expressionAddHTML(r.native_expressions, missed);
        wireExpressionAdds(exprs, r.native_expressions, "writing");
        // 🧩 막혔던 곳도 자동으로 담지 않는다 — 다른 모든 기능과 같이 ➕로 유저가 고른다.
        const gaps = $("#writing-gaps");
        if (gaps) {
          gaps.innerHTML = gapSolutionsHTML(r.gap_solutions);
          wireExpressionAdds(gaps, r.gap_solutions, "writing");
        }
      });
      $("#writing-next").addEventListener("click", newQuestion);
      $("#writing-qna-form").addEventListener("submit", async (qev) => {
        qev.preventDefault();
        const input = $("#writing-qna-input");
        const question = input.value.trim();
        if (!question) return;
        const qbtn = qev.target.querySelector("button");
        qbtn.disabled = true;
        qbtn.textContent = "답변 중...";
        try {
          await askQna(question);
          input.value = "";
          $("#writing-qna-log").innerHTML = qnaLogHTML();
        } catch (e) {
          toast(e.message);
        } finally {
          qbtn.disabled = false;
          qbtn.textContent = "질문하기";
        }
      });
      // 다시 쓰기 예약: 같은 질문(+3일) + 자매 질문(+8일). 자매 질문은 로컬에서 고른다(AI 0원).
      const sister = pickSister(mode, mode === "email" ? currentEmailPrompt.id : questionText);
      addRewrites(scheduleRewrites(r.record, sister, toSeoulDate(new Date().toISOString())));
      autoSaveRecord();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "첨삭 받기";
    }
  });
}
