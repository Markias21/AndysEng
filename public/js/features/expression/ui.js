// 표현 공부: 로컬 표현 모음(회화/토플)에서 표현 하나 제시 → 유저가 예문 작성 → AI가 첨삭/채점 → 다음 표현.
// 표현 생성 호출을 없애고 로컬 데이터에서 뽑는다(토큰 절약). 최근에 배운 표현은 피하고, 배운 표현은 복습 덱에 쌓인다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getRecords, addToDeck } from "../../shared/store.js";
import { pickFresh } from "../../shared/pick.js";
import { scoreDetail } from "../../shared/scoring.js";
import { conversationExpressions } from "./conversation-expressions.js";
import { toeflExpressions } from "./toefl-expressions.js";
import { $, esc, toast, scoreBreakdownHTML, rubricGuideHTML, correctionsHTML } from "../../shared/dom.js";

// 최근 이 개수만큼 배운 표현은 다시 나오지 않게 피한다.
const RECENT_EXPRESSIONS = 20;

// 컬렉션은 분리해서 관리한다. 유저가 회화/토플 중 하나를 골라 학습한다.
const COLLECTIONS = {
  conversation: { label: "💬 회화 표현", data: conversationExpressions },
  toefl: { label: "🎓 토플 표현", data: toeflExpressions },
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
    grades: {
      type: "object",
      description: "각 배점 요소를 S/A/B/C/F로 채점",
      properties: {
        naturalness: { type: "string", enum: ["S", "A", "B", "C", "F"] },
        grammar: { type: "string", enum: ["S", "A", "B", "C", "F"] },
        comprehension: { type: "string", enum: ["S", "A", "B", "C", "F"] },
      },
      required: ["naturalness", "grammar", "comprehension"],
      additionalProperties: false,
    },
  },
  required: ["corrections", "natural_version", "comment", "grades"],
  additionalProperties: false,
};

let current = null; // {expression, meaning, example}
let currentCollection = null; // "conversation" | "toefl"

function recentExpressions(collection) {
  return getRecords("expression")
    .filter((r) => r.collection === collection)
    .slice(-RECENT_EXPRESSIONS)
    .map((r) => r.expression);
}

function nextExpression() {
  const { data } = COLLECTIONS[currentCollection];
  const expr = pickFresh(data, recentExpressions(currentCollection), (e) => e.expression);
  if (!expr) return toast("표현을 불러오지 못했습니다.");
  current = expr;
  $("#expr-collection-label").textContent = COLLECTIONS[currentCollection].label;
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
- grades: grade each rubric component S/A/B/C/F (S excellent, F poor): naturalness (natural use of the target expression), grammar, comprehension (clarity of sentence structure).`,
    messages: [{ role: "user", content: `Learner's sentence: "${sentence}"` }],
    schema: REVIEW_SCHEMA,
  });
  const total = scoreDetail("expression", result.grades).total;
  appendRecord("expression", {
    score: total,
    grades: result.grades,
    expression: current.expression,
    collection: currentCollection,
    sentence,
  });
  addToDeck([{ ...current, source: `expression:${currentCollection}` }]);
  return result;
}

function startCollection(collection) {
  currentCollection = collection;
  nextExpression();
}

export function init() {
  $("#expr-rubric").innerHTML = rubricGuideHTML("expression");
  document.querySelectorAll("#expr-intro [data-collection]").forEach((btn) => {
    btn.addEventListener("click", () => startCollection(btn.dataset.collection));
  });

  $("#expr-next").addEventListener("click", nextExpression);

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
          <div class="fb-title">📝 피드백</div>
          ${scoreBreakdownHTML("expression", r.grades)}
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
