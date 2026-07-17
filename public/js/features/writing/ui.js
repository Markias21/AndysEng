// 글쓰기 공부: AI가 질문 제시 → 유저가 3~4문장 논설문 작성 → 문법 첨삭 + 교정문 + 원어민 답안 + 표현 제시.
// 첨삭에서 나온 표현들은 복습 덱에 자동으로 쌓인다.
import { chatText, chatJSON } from "../../shared/claude.js";
import { appendRecord, addToDeck } from "../../shared/store.js";
import { $, esc, toast, scoreBadge, correctionsHTML } from "../../shared/dom.js";

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
        },
        required: ["expression", "meaning", "example"],
        additionalProperties: false,
      },
    },
    score: { type: "integer", description: "0-100" },
  },
  required: ["corrections", "corrected_answer", "native_answer", "native_expressions", "score"],
  additionalProperties: false,
};

async function newQuestion() {
  const question = await chatText({
    system:
      "You create short opinion-essay prompts for a Korean English learner. Output only the prompt itself in English (one or two sentences), answerable with a light argumentative answer of 3-4 sentences. Vary topics widely: society, technology, daily life, culture, education.",
    messages: [{ role: "user", content: "Give me one new essay prompt." }],
    maxTokens: 300,
  });
  $("#writing-question").textContent = question;
  $("#writing-input").value = "";
  $("#writing-result").innerHTML = "";
  $("#writing-intro").classList.add("hidden");
  $("#writing-room").classList.remove("hidden");
}

async function review(question, answer) {
  const result = await chatJSON({
    system: `You are an English writing tutor for a Korean learner. Review the learner's short opinion essay:
1. corrections: every grammar error and awkward phrasing, with the reason explained in Korean.
2. corrected_answer: the learner's own answer with only grammatical fixes applied (keep their voice and argument).
3. native_answer: the same argument rewritten as a fluent native speaker would write it (3-4 sentences).
4. native_expressions: 3-5 useful native-like expressions related to this topic or taken from the native answer, each with Korean meaning and an example sentence.
5. score: 0-100 for grammar, naturalness, and clarity.`,
    messages: [{ role: "user", content: `Prompt: ${question}\n\nLearner's answer:\n${answer}` }],
    schema: REVIEW_SCHEMA,
    maxTokens: 8192,
  });
  // 글쓰기는 피드백 전체를 따로 저장한다 (스펙 요구사항).
  appendRecord("writing", { score: result.score, question, answer, feedback: result });
  addToDeck(result.native_expressions.map((e) => ({ ...e, source: "writing" })));
  return result;
}

export function init() {
  $("#writing-start").addEventListener("click", async () => {
    const btn = $("#writing-start");
    btn.disabled = true;
    try {
      await newQuestion();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
    }
  });

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
          <h4>📝 문법 첨삭 ${scoreBadge(r.score)}</h4>
          <div class="card">${r.corrections.length ? correctionsHTML(r.corrections) : "✅ 문법 오류가 없어요!"}</div>
          <h4>✔️ 교정된 답안</h4>
          <div class="card">${esc(r.corrected_answer)}</div>
          <h4>🌟 원어민 모범 답안</h4>
          <div class="card">${esc(r.native_answer)}</div>
          <h4>💡 익혀두면 좋은 표현 <span class="reason">(복습 덱에 담았어요)</span></h4>
          <div class="card"><ul>${r.native_expressions
            .map((e) => `<li><b>${esc(e.expression)}</b> — ${esc(e.meaning)}<br/><span class="reason">${esc(e.example)}</span></li>`)
            .join("")}</ul></div>
          <div class="row-end"><button class="btn-secondary" id="writing-next">다음 질문 →</button></div>
        </div>`;
      $("#writing-next").addEventListener("click", () => newQuestion().catch((e) => toast(e.message)));
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "첨삭 받기";
    }
  });
}
