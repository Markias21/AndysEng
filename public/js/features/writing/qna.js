// 방금 받은 첨삭에 대해 후속 질문을 주고받는다. 질문을 새로 받거나 다시 첨삭받으면 초기화된다.
// store에는 저장하지 않는 화면 전용 상태 — 세션 간 컨텍스트를 들고 가지 않는다.
import { chatJSON } from "../../shared/claude.js";
import { esc } from "../../shared/dom.js";
import { QNA_SCHEMA } from "./schema.js";

let context = null; // { question, answer, feedback }
let history = []; // 모델에 그대로 replay할 messages (질문에는 최초 1회 context를 포함)
let log = []; // 화면 표시용 { question, answer }

export function resetQna() {
  context = null;
  history = [];
  log = [];
}

/** 이번 첨삭 세션을 Q&A의 컨텍스트로 삼는다. */
export function startQna(next) {
  resetQna();
  context = next;
}

function contextText(ctx) {
  return `다음은 학생이 쓴 글쓰기 질문과 답안, 그리고 이미 받은 첨삭 결과입니다.

질문: ${ctx.question}
학생 답안: ${ctx.answer}
첨삭 결과(JSON): ${JSON.stringify(ctx.feedback)}

학생이 이 첨삭에 대해 궁금한 점을 물어볼 것입니다.`;
}

export function qnaLogHTML() {
  return log
    .map((t) => `<div class="qna-turn"><div class="qna-q">Q. ${esc(t.question)}</div><div class="qna-a">A. ${esc(t.answer)}</div></div>`)
    .join("");
}

export async function askQna(question) {
  const content = history.length === 0 ? `${contextText(context)}\n\n학생의 질문: ${question}` : question;
  const messages = [...history, { role: "user", content }];
  const result = await chatJSON({
    system: "You are an English writing tutor answering a Korean learner's follow-up question about feedback they already received on their essay. Answer entirely in Korean, clearly and concisely, referencing the specific corrections or grades when relevant.",
    messages,
    schema: QNA_SCHEMA,
    maxTokens: 1024,
  });
  history.push({ role: "user", content }, { role: "assistant", content: result.answer });
  log.push({ question, answer: result.answer });
  return result.answer;
}
