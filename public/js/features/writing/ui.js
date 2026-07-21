// 글쓰기 공부: 로컬 질문 제시 → 유저가 3~4문장 논설문 작성 → 문법 첨삭 + 교정문 + 원어민 답안 + 표현 제시.
// 질문은 로컬 데이터에서 뽑아 토큰을 아끼고, AI 호출은 첨삭에만 쓴다. 첨삭에서 나온 표현들은 복습 덱에 자동으로 쌓인다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getRecords, getProfile } from "../../shared/store.js";
import { pickFresh, sampleN } from "../../shared/pick.js";
import { scoreDetail } from "../../shared/scoring.js";
import { WRITING_TIPS } from "../../shared/levels.js";
import { autoSaveToGithub } from "../../shared/autosave.js";
import { takeTranslatorUses, TRANSLATOR_PENALTY } from "../../shared/translate.js";
import { writingPrompts } from "./prompts.js";
import { structureTemplateHTML, structureExpressions } from "./structure.js";
import {
  $, esc, toast, scoreBreakdownHTML, rubricGuideHTML, correctionsHTML,
  spellingHTML, sentenceLinesHTML, expressionAddHTML, wireExpressionAdds,
  translatorPenaltyHTML,
} from "../../shared/dom.js";

// 구조 제시 패널에서 한 번에 보여 줄 표현 개수.
const STRUCTURE_EXPR_COUNT = 5;

// 최근 이 개수만큼의 질문은 다시 나오지 않게 피한다.
const RECENT_PROMPTS = 20;

// 답안은 문장 단위로 받아 한 줄씩 보여 주고, 각 문장의 한국어 해석을 함께 붙인다.
// 고친 부분·새로 쓴 중요한 표현은 [[...]]로 감싸 밑줄로 렌더한다.
const SENTENCE_ITEM = {
  type: "object",
  properties: {
    sentence: { type: "string", description: "영어 문장 한 개. 고친 부분이나 새로 쓴 중요한 표현은 [[...]]로 감쌀 것" },
    translation: { type: "string", description: "이 문장의 한국어 해석" },
  },
  required: ["sentence", "translation"],
  additionalProperties: false,
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    spelling: {
      type: "array",
      description: "오타·대소문자 실수만. 설명 없이 원문과 교정형만.",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
        },
        required: ["original", "corrected"],
        additionalProperties: false,
      },
    },
    corrections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          reason: { type: "string", description: "이유를 한국어로 설명" },
        },
        required: ["original", "corrected", "reason"],
        additionalProperties: false,
      },
    },
    corrected_answer: { type: "array", items: SENTENCE_ITEM, description: "문법적으로 맞게 고친 답안, 문장 단위" },
    native_answer: { type: "array", items: SENTENCE_ITEM, description: "원어민이 쓴 것처럼 다듬은 모범 답안, 문장 단위" },
    native_expressions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          expression: { type: "string" },
          meaning: { type: "string", description: "뜻을 한국어로" },
          example: { type: "string" },
          level: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"], description: "이 표현의 CEFR 난이도" },
        },
        required: ["expression", "meaning", "example", "level"],
        additionalProperties: false,
      },
    },
    cefr_level: {
      type: "string",
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      description: "이 글의 전체 품질(구체성·분량·문법·표현)로 매긴 CEFR 레벨",
    },
    grades: {
      type: "object",
      description: "각 배점 요소를 S/A/B/C/F로 채점",
      properties: {
        essay_structure: { type: "string", enum: ["S", "A", "B", "C", "F"] },
        grammar: { type: "string", enum: ["S", "A", "B", "C", "F"] },
        comprehension: { type: "string", enum: ["S", "A", "B", "C", "F"] },
        modifier_naturalness: { type: "string", enum: ["S", "A", "B", "C", "F"] },
      },
      required: ["essay_structure", "grammar", "comprehension", "modifier_naturalness"],
      additionalProperties: false,
    },
  },
  required: ["spelling", "corrections", "corrected_answer", "native_answer", "native_expressions", "cefr_level", "grades"],
  additionalProperties: false,
};

function recentQuestions() {
  return getRecords("writing")
    .slice(-RECENT_PROMPTS)
    .map((r) => r.question);
}

function showTip() {
  const level = getProfile().level;
  const el = $("#writing-tip");
  if (el) el.innerHTML = `<b>${esc(level)} 목표:</b> ${esc(WRITING_TIPS[level] || WRITING_TIPS.B1)}`;
}

function newQuestion() {
  const question = pickFresh(writingPrompts, recentQuestions());
  if (!question) return toast("글쓰기 질문을 불러오지 못했습니다.");
  takeTranslatorUses("writing"); // 이전 질문에서 남은 번역기 사용 기록은 새 질문으로 넘기지 않는다.
  $("#writing-question").textContent = question;
  showTip();
  $("#writing-input").value = "";
  $("#writing-result").innerHTML = "";
  $("#writing-intro").classList.add("hidden");
  $("#writing-room").classList.remove("hidden");
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

async function review(question, answer) {
  const level = getProfile().level;
  const result = await chatJSON({
    system: `You are an English writing tutor for a Korean learner whose target level is CEFR ${level}.

Typos and capitalization are NOT part of the assessment. Never count them as grammar errors, never explain them, and never let them affect any grade.

1. spelling: list only typos and capitalization slips, as original -> corrected. No explanation, no reason. Empty array if none.
2. corrections: real grammar errors and awkward phrasing only (never typos or capitalization), with the reason explained in Korean.
3. corrected_answer: the learner's own answer with only grammatical fixes applied (keep their voice and argument), split into one object per sentence with a Korean translation of that sentence.
4. native_answer: the same argument rewritten as a fluent native speaker would write it (3-4 sentences), split the same way with a Korean translation per sentence. Write it at CEFR ${level} — use vocabulary and sentence patterns the learner at that level can actually reuse, not higher.
5. In both corrected_answer and native_answer, wrap in [[ ]] the parts that fix something the learner got wrong or that introduce an important expression worth noticing. Wrap the phrase itself, not whole sentences, and leave unchanged parts unwrapped.
6. native_expressions: 3-5 useful native-like expressions related to this topic or taken from the native answer, each with Korean meaning, an example sentence, and its CEFR level (A1-C2).
7. cefr_level: the CEFR level (A1-C2) this essay actually demonstrates, judged on specificity, length, grammar, and appropriate expression.
8. grades: grade each rubric component S/A/B/C/F (S excellent, F poor): essay_structure (organization and flow), grammar (ignoring typos and capitalization), comprehension (clarity of sentence structure), modifier_naturalness (natural use of adjectives, adverbs, and expressions).`,
    messages: [{ role: "user", content: `Prompt: ${question}\n\nLearner's answer:\n${answer}` }],
    schema: REVIEW_SCHEMA,
    maxTokens: 8192,
  });
  const rawTotal = scoreDetail("writing", result.grades).total;
  const translatorUses = takeTranslatorUses("writing");
  const penalty = translatorUses * TRANSLATOR_PENALTY.writing;
  const total = Math.max(0, rawTotal - penalty);
  // 글쓰기는 피드백 전체를 따로 저장한다 (스펙 요구사항).
  appendRecord("writing", { score: total, grades: result.grades, cefr: result.cefr_level, question, answer, feedback: result, translatorUses });
  return { ...result, translatorUses, penalty, total };
}

export function init() {
  $("#writing-rubric").innerHTML = rubricGuideHTML("writing");
  $("#writing-start").addEventListener("click", newQuestion);
  const reroll = $("#writing-reroll");
  if (reroll) reroll.addEventListener("click", newQuestion);
  $("#writing-structure-btn").addEventListener("click", toggleStructure);
  $("#structure-refresh").addEventListener("click", renderStructureExpressions);

  $("#writing-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const answer = $("#writing-input").value.trim();
    if (!answer) return toast("답안을 먼저 작성해 주세요.");
    const btn = ev.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = "첨삭 중...";
    try {
      const r = await review($("#writing-question").textContent, answer);
      const result = $("#writing-result");
      result.innerHTML = `
        <div class="result-section">
          <h4>🏅 점수 <span class="cefr">이 글의 레벨: ${esc(r.cefr_level)}</span></h4>
          <div class="card">${scoreBreakdownHTML("writing", r.grades)}${translatorPenaltyHTML(r.translatorUses, r.penalty, r.total)}</div>
          <h4>📝 문법 첨삭</h4>
          <div class="card">${r.corrections.length ? correctionsHTML(r.corrections) : "✅ 문법 오류가 없어요!"}</div>
          ${r.spelling?.length ? `<h4>✏️ 오타·대소문자 <span class="reason">(점수에는 반영하지 않아요)</span></h4>
          <div class="card">${spellingHTML(r.spelling)}</div>` : ""}
          <h4>✔️ 교정된 답안</h4>
          <div class="card">${sentenceLinesHTML(r.corrected_answer)}</div>
          <h4>🌟 원어민 모범 답안 <span class="cefr">${esc(getProfile().level)}</span></h4>
          <div class="card">${sentenceLinesHTML(r.native_answer)}</div>
          <h4>💡 익혀두면 좋은 표현 <span class="reason">(담을 것만 골라 복습에 추가하세요)</span></h4>
          <div class="card" id="writing-exprs">${expressionAddHTML(r.native_expressions)}</div>
          <div class="row-end"><button class="btn-secondary" id="writing-next">다음 질문 →</button></div>
        </div>`;
      wireExpressionAdds($("#writing-exprs"), r.native_expressions, "writing");
      $("#writing-next").addEventListener("click", newQuestion);
      autoSaveToGithub();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "첨삭 받기";
    }
  });
}
