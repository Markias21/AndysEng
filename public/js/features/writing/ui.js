// 글쓰기 공부: 로컬 질문 제시 → 유저가 답 작성 → 문법 첨삭 + 교정문 + 원어민 답안 + 표현 제시.
// 두 유형을 다룬다: 토론형(discussion, 3~4문장 논설)과 이메일(email, 토플 2026 Write an Email).
// 질문·상황은 로컬 데이터에서 뽑아 토큰을 아끼고, AI 호출은 첨삭에만 쓴다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getRecords, getProfile } from "../../shared/store.js";
import { pickFresh, sampleN } from "../../shared/pick.js";
import { scoreDetail } from "../../shared/scoring.js";
import { WRITING_TIPS } from "../../shared/levels.js";
import { autoSaveRecord } from "../../shared/autosave.js";
import { takeTranslatorUses, TRANSLATOR_PENALTY } from "../../shared/translate.js";
import { writingPrompts } from "./prompts.js";
import { emailPrompts } from "./email-prompts.js";
import { toeflBand } from "./toefl.js";
import { emailBand } from "./email.js";
import { structureTemplateHTML, structureExpressions } from "./structure.js";
import { REVIEW_SCHEMA, EMAIL_REVIEW_SCHEMA } from "./schema.js";
import { discussionSystem, emailSystem } from "./review-prompt.js";
import { startQna, resetQna, askQna, qnaLogHTML } from "./qna.js";
import { mountCloze } from "./cloze-ui.js";
import { attachTypingTimer } from "../../shared/typing-timer.js";
import {
  $, esc, toast, scoreBreakdownHTML, rubricGuideHTML, correctionsHTML,
  spellingHTML, sentenceLinesHTML, expressionAddHTML, wireExpressionAdds,
  translatorPenaltyHTML,
} from "../../shared/dom.js";

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

function recentQuestions() {
  return getRecords("writing")
    .filter((r) => (r.mode || "discussion") === "discussion")
    .slice(-RECENT_PROMPTS)
    .map((r) => r.question);
}

function recentEmailIds() {
  return getRecords("writing")
    .filter((r) => r.mode === "email")
    .slice(-RECENT_PROMPTS)
    .map((r) => r.promptId);
}

function showTip() {
  const el = $("#writing-tip");
  if (currentMode === "email") {
    el.innerHTML = `<b>이메일 목표:</b> ${esc(EMAIL_TIP)}`;
  } else {
    const level = getProfile().level;
    el.innerHTML = `<b>${esc(level)} 목표:</b> ${esc(WRITING_TIPS[level] || WRITING_TIPS.B1)}`;
  }
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
  $("#writing-room").classList.remove("hidden");
}

function startMode(mode) {
  currentMode = mode;
  newQuestion();
}

function backToModes() {
  $("#writing-structure").classList.add("hidden");
  $("#writing-room").classList.add("hidden");
  $("#writing-intro").classList.remove("hidden");
}

function renderModes() {
  const grid = $("#writing-modes");
  grid.innerHTML = MODES.map((m) => `<button class="btn-secondary category-btn" type="button" data-mode="${m.id}">${esc(m.label)}</button>`).join("");
  grid.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => startMode(b.dataset.mode)));
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

/** bullets_covered([{bullet, covered, comment}])를 체크리스트로 렌더한다. */
function bulletsCoveredHTML(bulletsCovered) {
  return `<ul class="bullet-list">${bulletsCovered
    .map(
      (b) =>
        `<li class="${b.covered ? "bullet-ok" : "bullet-miss"}">${b.covered ? "✅" : "❌"} ${esc(b.bullet)}<br/><span class="reason">${esc(b.comment)}</span></li>`
    )
    .join("")}</ul>`;
}

async function reviewDiscussion(question, answer) {
  const level = getProfile().level;
  const result = await chatJSON({
    system: discussionSystem(level),
    messages: [{ role: "user", content: `Prompt: ${question}\n\nLearner's answer:\n${answer}` }],
    schema: REVIEW_SCHEMA,
    maxTokens: 8192,
  });
  const rawTotal = scoreDetail("writing", result.grades).total;
  const translatorUses = takeTranslatorUses("writing");
  const penalty = translatorUses * TRANSLATOR_PENALTY.writing;
  const total = Math.max(0, rawTotal - penalty);
  appendRecord("writing", { mode: "discussion", score: total, grades: result.grades, cefr: result.cefr_level, toefl: result.toefl_score, question, answer, feedback: result, translatorUses });
  return { ...result, translatorUses, penalty, total };
}

async function reviewEmail(promptData, answer) {
  const level = getProfile().level;
  const result = await chatJSON({
    system: emailSystem(level, promptData),
    messages: [{ role: "user", content: `Learner's email draft:\n${answer}` }],
    schema: EMAIL_REVIEW_SCHEMA,
    maxTokens: 8192,
  });
  const rawTotal = scoreDetail("email", result.grades).total;
  const translatorUses = takeTranslatorUses("writing");
  const penalty = translatorUses * TRANSLATOR_PENALTY.writing;
  const total = Math.max(0, rawTotal - penalty);
  appendRecord("writing", {
    mode: "email", promptId: promptData.id, score: total, grades: result.grades,
    cefr: result.cefr_level, toefl: result.toefl_score, question: promptData.situation, answer, feedback: result, translatorUses,
  });
  return { ...result, translatorUses, penalty, total };
}

function feedbackHTML(r, mode) {
  const isEmail = mode === "email";
  const band = isEmail ? emailBand(r.toefl_score) : toeflBand(r.toefl_score);
  const maxScore = isEmail ? 5 : 4;
  const bulletsSection = isEmail
    ? `<h4>📋 요구 항목 충족 여부</h4><div class="card">${bulletsCoveredHTML(r.bullets_covered)}</div>`
    : "";
  return `
    <h4>🎯 TOEFL ${isEmail ? "이메일" : "라이팅"} <span class="cefr">${r.toefl_score} / ${maxScore}</span></h4>
    <div class="card">${esc(band.ko)}</div>
    ${bulletsSection}
    <h4>🏅 점수 <span class="cefr">이 글의 레벨: ${esc(r.cefr_level)}</span></h4>
    <div class="card">${scoreBreakdownHTML(isEmail ? "email" : "writing", r.grades)}${translatorPenaltyHTML(r.translatorUses, r.penalty, r.total)}</div>
    <h4>📝 문법 첨삭</h4>
    <div class="card">${r.corrections.length ? correctionsHTML(r.corrections) : "✅ 문법 오류가 없어요!"}</div>
    ${r.spelling?.length ? `<h4>✏️ 오타·대소문자 <span class="reason">(점수에는 반영하지 않아요)</span></h4>
    <div class="card">${spellingHTML(r.spelling)}</div>` : ""}
    <h4>✔️ 교정된 답안</h4>
    <div class="card">${sentenceLinesHTML(r.corrected_answer)}</div>
    <h4>🌟 원어민 모범 ${isEmail ? "이메일" : "답안"} <span class="cefr">${esc(getProfile().level)}</span></h4>
    <div class="card">${sentenceLinesHTML(r.native_answer)}</div>
    <h4>💡 익혀두면 좋은 표현 <span class="reason">(담을 것만 골라 복습에 추가하세요)</span></h4>
    <div class="card" id="writing-exprs"></div>
    <h4>💬 첨삭에 대해 질문하기</h4>
    <div class="card">
      <div id="writing-qna-log"></div>
      <form id="writing-qna-form">
        <textarea id="writing-qna-input" rows="2" placeholder="왜 이렇게 고쳐졌는지, 다른 표현은 없는지 물어보세요..."></textarea>
        <div class="row-end"><button class="btn-secondary" type="submit">질문하기</button></div>
      </form>
    </div>
    <div class="row-end"><button class="btn-secondary" id="writing-next">다음 질문 →</button></div>`;
}

export function init() {
  renderModes();
  typingTimer = attachTypingTimer([$("#writing-input")], [$("#writing-timer")]);
  $("#writing-structure-btn").addEventListener("click", toggleStructure);
  $("#structure-refresh").addEventListener("click", renderStructureExpressions);
  $("#writing-mode-btn").addEventListener("click", backToModes);
  $("#writing-reroll").addEventListener("click", newQuestion);

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
      autoSaveRecord();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "첨삭 받기";
    }
  });
}
