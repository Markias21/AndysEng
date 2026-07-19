// 회화 공부: 로컬 주제로 시작(영어 배경설명 + 파트너 첫 대사)하고, 유저 답변마다 AI가 첨삭/채점 후 대화를 이어간다.
// 주제·오프닝은 로컬 데이터에서 뽑아 토큰을 아끼고, AI 호출은 턴별 첨삭/이어가기에만 쓴다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getRecords, getProfile, addToDeck } from "../../shared/store.js";
import { pickFresh } from "../../shared/pick.js";
import { scoreDetail } from "../../shared/scoring.js";
import { CONV_GUIDANCE } from "../../shared/levels.js";
import { conversationTopics } from "./topics.js";
import { $, esc, toast, scoreBreakdownHTML, rubricGuideHTML, correctionsHTML } from "../../shared/dom.js";

// 최근 이 개수만큼의 주제는 새로고침해도 다시 나오지 않게 피한다.
const RECENT_TOPICS = 20;

// 표현 수집 주기: 이만큼의 유저 턴마다 한 번 유용한 표현을 뽑아 복습 덱에 쌓는다(토큰 절약).
const EXTRACT_EVERY = 3;

const EXPRESSION_ITEM = {
  type: "object",
  properties: {
    expression: { type: "string" },
    meaning: { type: "string", description: "뜻을 한국어로" },
    example: { type: "string" },
    level: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"], description: "이 표현의 CEFR 난이도" },
  },
  required: ["expression", "meaning", "example", "level"],
  additionalProperties: false,
};

// 표현 추출 여부에 따라 스키마를 만든다(추출하지 않는 턴엔 expressions 필드를 아예 빼 토큰을 아낀다).
function buildReplySchema(extract) {
  const properties = {
    corrections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          reason: { type: "string", description: "이유를 한국어로 간단히" },
        },
        required: ["original", "corrected", "reason"],
        additionalProperties: false,
      },
    },
    natural_alternative: {
      type: "string",
      description: "원어민이라면 이렇게 말했을 문장. 이미 자연스러우면 빈 문자열.",
    },
    grades: {
      type: "object",
      description: "각 배점 요소를 S/A/B/C/F로 채점",
      properties: {
        naturalness: { type: "string", enum: ["S", "A", "B", "C", "F"] },
        grammar: { type: "string", enum: ["S", "A", "B", "C", "F"] },
        structure: { type: "string", enum: ["S", "A", "B", "C", "F"] },
      },
      required: ["naturalness", "grammar", "structure"],
      additionalProperties: false,
    },
    reply: { type: "string", description: "대화를 자연스럽게 이어가는 영어 답변, 1-3문장, 질문으로 끝내기" },
  };
  const required = ["corrections", "natural_alternative", "grades", "reply"];
  if (extract) {
    properties.expressions = { type: "array", items: EXPRESSION_ITEM };
    required.push("expressions");
  }
  return { type: "object", properties, required, additionalProperties: false };
}

const convHistory = []; // {role: "ai"|"user", text}
let currentTopic = null;
let userTurns = 0;

// 시스템 프롬프트는 턴마다 절대 바뀌지 않아야 프롬프트 캐시가 유지된다.
// 표현 추출 지시처럼 턴마다 달라지는 내용은 여기 넣지 말고 유저 메시지 쪽(항상 캐시되지 않는 부분)에 넣는다.
function tutorSystem(topic, level) {
  return `You are a friendly native English conversation partner for a Korean learner.
The current scene is: ${topic.scene}
Stay in that setting and keep the conversation consistent with it.
The learner's level is CEFR ${level}. Pitch your English to that level: ${CONV_GUIDANCE[level] || CONV_GUIDANCE.B1}.
Speak natural, everyday English. Keep each message to 1-3 sentences and always end with something the learner can respond to (a question or an invitation to share).
You also review the learner's latest message:
- List grammar mistakes and unnatural (non-native) phrasings as corrections. Explain each reason briefly in Korean.
- If the message is already natural, return an empty corrections array and an empty natural_alternative.
- Grade each rubric component S/A/B/C/F (S excellent, F poor): naturalness, grammar, structure (clarity of sentence structure). A short but perfectly natural reply can still earn S.
- Then continue the conversation naturally in "reply", reacting to what the learner said and staying in the scene.
- When the learner's message ends with an extraction request in parentheses, also fill "expressions" with that many useful native-like expression(s) from your reply or this conversation, worth reviewing at around the learner's level. Each needs a Korean meaning, an example sentence, and its CEFR level.`;
}

function addScene(topic) {
  const el = document.createElement("div");
  el.className = "scene-card";
  el.innerHTML = `<span class="scene-label">🎬 Scene</span><p>${esc(topic.scene)}</p>`;
  $("#conv-messages").appendChild(el);
}

function addBubble(role, text) {
  const el = document.createElement("div");
  el.className = `bubble ${role}`;
  el.textContent = text;
  $("#conv-messages").appendChild(el);
  el.scrollIntoView({ behavior: "smooth", block: "end" });
  return el;
}

// 유저 발화 한 턴을 감싸는 행. 데스크탑에서는 피드백이 이 안에서 말풍선 왼쪽에 붙는다.
function addUserTurn(text) {
  const turn = document.createElement("div");
  turn.className = "turn user-turn";
  const bubble = document.createElement("div");
  bubble.className = "bubble user";
  bubble.textContent = text;
  turn.appendChild(bubble);
  $("#conv-messages").appendChild(turn);
  turn.scrollIntoView({ behavior: "smooth", block: "end" });
  return turn;
}

function feedbackHTML({ corrections, natural_alternative, grades }) {
  const good = (!corrections || corrections.length === 0) && !natural_alternative;
  return `<div class="fb-title">${good ? "✅ 자연스러워요!" : "📝 피드백"}</div>
       ${scoreBreakdownHTML("conversation", grades)}
       ${correctionsHTML(corrections)}
       ${natural_alternative ? `<div>💬 원어민이라면: <span class="fixed">${esc(natural_alternative)}</span></div>` : ""}`;
}

function attachFeedback(turn, result) {
  const good = (!result.corrections || result.corrections.length === 0) && !result.natural_alternative;
  const el = document.createElement("div");
  el.className = `feedback ${good ? "good" : ""}`;
  el.innerHTML = feedbackHTML(result);
  // 말풍선 앞에 넣어 데스크탑에서 왼쪽(빈 공간)에 오도록 한다. 모바일은 CSS가 아래로 쌓는다.
  turn.insertBefore(el, turn.firstChild);
  el.scrollIntoView({ behavior: "smooth", block: "end" });
}

function recentTopicIds() {
  return getRecords("sessions")
    .filter((r) => r.feature === "conversation" && r.topicId)
    .slice(-RECENT_TOPICS)
    .map((r) => r.topicId);
}

function start() {
  const topic = pickFresh(conversationTopics, recentTopicIds(), (t) => t.id);
  if (!topic) return toast("회화 주제를 불러오지 못했습니다.");
  currentTopic = topic;
  convHistory.length = 0;
  userTurns = 0;
  appendRecord("sessions", { feature: "conversation", topicId: topic.id });
  $("#conv-messages").innerHTML = "";
  $("#conv-intro").classList.add("hidden");
  $("#conv-room").classList.remove("hidden");
  addScene(topic);
  convHistory.push({ role: "ai", text: topic.opening });
  addBubble("ai", topic.opening);
  $("#conv-input").focus();
}

// 이전 턴까지의 히스토리를 멀티턴 messages로 바꾸고, 마지막 기존 메시지에 캐시 breakpoint를 찍는다.
// 다음 요청부터는 이 지점까지 전부 캐시에서 읽어 오고, 새로 추가되는 턴만 정가로 처리된다.
function buildMessages(newUserText, extractCount) {
  const messages = convHistory.map((m, i) => {
    const role = m.role === "user" ? "user" : "assistant";
    if (i !== convHistory.length - 1) return { role, content: m.text };
    return { role, content: [{ type: "text", text: m.text, cache_control: { type: "ephemeral" } }] };
  });
  const userText = extractCount
    ? `${newUserText}\n\n(Extract ${extractCount} useful expression(s) from this exchange now.)`
    : newUserText;
  messages.push({ role: "user", content: userText });
  return messages;
}

async function reply(text) {
  const { level, exprPerConv } = getProfile();
  // EXTRACT_EVERY 턴마다 한 번 표현을 뽑는다. 뽑을 개수는 유저 설정(1~3).
  const extractCount = userTurns % EXTRACT_EVERY === 0 ? Math.max(1, Math.min(3, exprPerConv || 1)) : 0;
  const result = await chatJSON({
    system: [{ type: "text", text: tutorSystem(currentTopic, level), cache_control: { type: "ephemeral" } }],
    messages: buildMessages(text, extractCount),
    schema: buildReplySchema(extractCount > 0),
  });
  const total = scoreDetail("conversation", result.grades).total;
  appendRecord("conversation", { score: total, grades: result.grades, sentence: text });
  if (result.expressions?.length) {
    addToDeck(result.expressions.map((e) => ({ ...e, source: "conversation" })));
  }
  return result;
}

export function init() {
  $("#conv-rubric").innerHTML = rubricGuideHTML("conversation");
  $("#conv-start").addEventListener("click", start);
  const reroll = $("#conv-reroll");
  if (reroll) reroll.addEventListener("click", start);

  $("#conv-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = $("#conv-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    userTurns += 1;
    const turn = addUserTurn(text);
    const typing = addBubble("ai typing", "생각 중...");
    try {
      const result = await reply(text);
      convHistory.push({ role: "user", text });
      typing.remove();
      attachFeedback(turn, result);
      convHistory.push({ role: "ai", text: result.reply });
      addBubble("ai", result.reply);
    } catch (e) {
      userTurns -= 1;
      typing.remove();
      toast(e.message);
    }
  });
}
