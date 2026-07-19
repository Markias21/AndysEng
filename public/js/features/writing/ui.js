// 글쓰기 공부: 로컬 질문 제시 → 유저가 3~4문장 논설문 작성 → 문법 첨삭 + 교정문 + 원어민 답안 + 표현 제시.
// 질문은 로컬 데이터에서 뽑아 토큰을 아끼고, AI 호출은 첨삭에만 쓴다. 첨삭에서 나온 표현들은 복습 덱에 자동으로 쌓인다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, addToDeck, getRecords, getProfile } from "../../shared/store.js";
import { pickFresh } from "../../shared/pick.js";
import { scoreDetail } from "../../shared/scoring.js";
import { WRITING_TIPS } from "../../shared/levels.js";
import { writingPrompts } from "./prompts.js";
import { $, esc, toast, scoreBreakdownHTML, rubricGuideHTML, correctionsHTML } from "../../shared/dom.js";

// 최근 이 개수만큼의 질문은 다시 나오지 않게 피한다.
const RECENT_PROMPTS = 20;

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
          reason: { type: "string", description: "이유를 한국어로 설명" },
        },
        required: ["original", "corrected", "reason"],
        additionalProperties: false,
      },
    },
    corrected_answer: { type: "string", description: "문법적으로 맞게 고친 전체 답안" },
    native_answer: { type: "string", description: "같은 주장을 원어민이 쓴 것처럼 다듬은 모범 답안" },
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
  required: ["corrections", "corrected_answer", "native_answer", "native_expressions", "cefr_level", "grades"],
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
  $("#writing-question").textContent = question;
  showTip();
  $("#writing-input").value = "";
  $("#writing-result").innerHTML = "";
  $("#writing-intro").classList.add("hidden");
  $("#writing-room").classList.remove("hidden");
}

async function review(question, answer) {
  const level = getProfile().level;
  const result = await chatJSON({
    system: `You are an English writing tutor for a Korean learner whose target level is CEFR ${level}.
1. corrections: every grammar error and awkward phrasing, with the reason explained in Korean.
2. corrected_answer: the learner's own answer with only grammatical fixes applied (keep their voice and argument).
3. native_answer: the same argument rewritten as a fluent native speaker would write it (3-4 sentences).
4. native_expressions: 3-5 useful native-like expressions related to this topic or taken from the native answer, each with Korean meaning, an example sentence, and its CEFR level (A1-C2).
5. cefr_level: the CEFR level (A1-C2) this essay actually demonstrates, judged on specificity, length, grammar, and appropriate expression.
6. grades: grade each rubric component S/A/B/C/F (S excellent, F poor): essay_structure (organization and flow), grammar, comprehension (clarity of sentence structure), modifier_naturalness (natural use of adjectives, adverbs, and expressions).`,
    messages: [{ role: "user", content: `Prompt: ${question}\n\nLearner's answer:\n${answer}` }],
    schema: REVIEW_SCHEMA,
    maxTokens: 8192,
  });
  // 글쓰기는 피드백 전체를 따로 저장한다 (스펙 요구사항).
  const total = scoreDetail("writing", result.grades).total;
  appendRecord("writing", { score: total, grades: result.grades, cefr: result.cefr_level, question, answer, feedback: result });
  addToDeck(result.native_expressions.map((e) => ({ ...e, source: "writing" })));
  return result;
}

export function init() {
  $("#writing-rubric").innerHTML = rubricGuideHTML("writing");
  $("#writing-start").addEventListener("click", newQuestion);
  const reroll = $("#writing-reroll");
  if (reroll) reroll.addEventListener("click", newQuestion);

  $("#writing-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const answer = $("#writing-input").value.trim();
    if (!answer) return toast("답안을 먼저 작성해 주세요.");
    const btn = ev.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = "첨삭 중...";
    try {
      const r = await review($("#writing-question").textContent, answer);
      $("#writing-result").innerHTML = `
        <div class="result-section">
          <h4>🏅 점수 <span class="cefr">이 글의 레벨: ${esc(r.cefr_level)}</span></h4>
          <div class="card">${scoreBreakdownHTML("writing", r.grades)}</div>
          <h4>📝 문법 첨삭</h4>
          <div class="card">${r.corrections.length ? correctionsHTML(r.corrections) : "✅ 문법 오류가 없어요!"}</div>
          <h4>✔️ 교정된 답안</h4>
          <div class="card">${esc(r.corrected_answer)}</div>
          <h4>🌟 원어민 모범 답안</h4>
          <div class="card">${esc(r.native_answer)}</div>
          <h4>💡 익혀두면 좋은 표현 <span class="reason">(복습 덱에 담았어요)</span></h4>
          <div class="card"><ul>${r.native_expressions
            .map((e) => `<li><b>${esc(e.expression)}</b>${e.level ? ` <span class="cefr">${esc(e.level)}</span>` : ""} — ${esc(e.meaning)}<br/><span class="reason">${esc(e.example)}</span></li>`)
            .join("")}</ul></div>
          <div class="row-end"><button class="btn-secondary" id="writing-next">다음 질문 →</button></div>
        </div>`;
      $("#writing-next").addEventListener("click", newQuestion);
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "첨삭 받기";
    }
  });
}
