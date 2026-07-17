// 표현 공부: 표현 하나 제시 → 유저가 예문 작성 → 첨삭/채점 → 다음 표현.
// API 절약을 위해 한 번 호출에 5개를 받아 큐에 쌓아두고, 학습한 표현은 복습 덱에 들어간다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getRecords, addToDeck, takeQueuedExpression, queueExpressions } from "../../shared/store.js";
import { $, esc, toast, scoreBadge, correctionsHTML } from "../../shared/dom.js";

const BATCH_SIZE = 5;

const BATCH_SCHEMA = {
  type: "object",
  properties: {
    expressions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          expression: { type: "string" },
          meaning: { type: "string", description: "뜻을 한국어로" },
          example: { type: "string", description: "영어 예문 하나" },
        },
        required: ["expression", "meaning", "example"],
        additionalProperties: false,
      },
    },
  },
  required: ["expressions"],
  additionalProperties: false,
};

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
          reason: { type: "string", description: "이유를 한국어로" },
        },
        required: ["original", "corrected", "reason"],
        additionalProperties: false,
      },
    },
    natural_version: { type: "string", description: "원어민이라면 이렇게 쓸 문장" },
    comment: { type: "string", description: "표현을 제대로 활용했는지 한국어로 한두 문장 평가" },
    score: { type: "integer", description: "0-100" },
  },
  required: ["corrections", "natural_version", "comment", "score"],
  additionalProperties: false,
};

let current = null; // {expression, meaning, example}

async function refillQueue() {
  const recent = getRecords("expression").slice(-30).map((r) => r.expression);
  const result = await chatJSON({
    system: `You teach useful, high-frequency native English expressions (idioms, phrasal verbs, collocations) to a Korean intermediate learner. Give exactly ${BATCH_SIZE} different expressions, each with its Korean meaning and one natural example sentence that contains the expression verbatim.`,
    messages: [
      {
        role: "user",
        content: recent.length
          ? `Give me ${BATCH_SIZE} new expressions. Do NOT repeat any of these: ${recent.join(", ")}`
          : `Give me ${BATCH_SIZE} new expressions.`,
      },
    ],
    schema: BATCH_SCHEMA,
  });
  queueExpressions(result.expressions);
}

async function nextExpression() {
  let expr = takeQueuedExpression();
  if (!expr) {
    await refillQueue();
    expr = takeQueuedExpression();
  }
  if (!expr) throw new Error("표현을 받아오지 못했습니다. 다시 시도해 주세요.");
  current = expr;
  $("#expr-word").textContent = expr.expression;
  $("#expr-meaning").textContent = expr.meaning;
  $("#expr-example").textContent = `예문: ${expr.example}`;
  $("#expr-input").value = "";
  $("#expr-result").innerHTML = "";
  $("#expr-next-row").classList.add("hidden");
  $("#expr-intro").classList.add("hidden");
  $("#expr-room").classList.remove("hidden");
}

async function review(sentence) {
  const result = await chatJSON({
    system: `You review a Korean learner's example sentence using the target expression "${current.expression}".
- corrections: grammar errors and unnatural phrasings, reasons in Korean.
- natural_version: how a native speaker would write the same idea using the expression.
- comment: one or two sentences in Korean on whether the expression was used correctly.
- score: 0-100 (grammar, naturalness, and correct use of the expression).`,
    messages: [{ role: "user", content: `Learner's sentence: "${sentence}"` }],
    schema: REVIEW_SCHEMA,
  });
  appendRecord("expression", { score: result.score, expression: current.expression, sentence });
  addToDeck([{ ...current, source: "expression" }]);
  return result;
}

export function init() {
  $("#expr-start").addEventListener("click", async () => {
    const btn = $("#expr-start");
    btn.disabled = true;
    try {
      await nextExpression();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
    }
  });

  $("#expr-next").addEventListener("click", () => nextExpression().catch((e) => toast(e.message)));

  $("#expr-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const sentence = $("#expr-input").value.trim();
    if (!sentence) return toast("예문을 먼저 작성해 주세요.");
    const btn = ev.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = "첨삭 중...";
    try {
      const r = await review(sentence);
      $("#expr-result").innerHTML = `
        <div class="feedback ${r.corrections.length ? "" : "good"}">
          <div class="fb-title">📝 피드백 ${scoreBadge(r.score)}</div>
          ${correctionsHTML(r.corrections)}
          <div>💬 원어민이라면: <span class="fixed">${esc(r.natural_version)}</span></div>
          <div class="reason mt-6">${esc(r.comment)}</div>
        </div>`;
      $("#expr-next-row").classList.remove("hidden");
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "첨삭 받기";
    }
  });
}
