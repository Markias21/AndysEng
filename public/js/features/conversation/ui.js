// 회화 공부: 로컬 주제로 시작(영어 배경설명 + 파트너 첫 대사)하고, 유저 답변마다 AI가 첨삭/채점 후 대화를 이어간다.
// 주제·오프닝은 로컬 데이터에서 뽑아 토큰을 아끼고, AI 호출은 턴별 첨삭/이어가기에만 쓴다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getRecords } from "../../shared/store.js";
import { pickFresh } from "../../shared/pick.js";
import { conversationTopics } from "./topics.js";
import { $, esc, toast, scoreBadge, correctionsHTML } from "../../shared/dom.js";

// 최근 이 개수만큼의 주제는 새로고침해도 다시 나오지 않게 피한다.
const RECENT_TOPICS = 20;

const REPLY_SCHEMA = {
  type: "object",
  properties: {
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
    score: { type: "integer", description: "0-100, 문법과 자연스러움 종합 점수" },
    reply: { type: "string", description: "대화를 자연스럽게 이어가는 영어 답변, 1-3문장, 질문으로 끝내기" },
  },
  required: ["corrections", "natural_alternative", "score", "reply"],
  additionalProperties: false,
};

const convHistory = []; // {role: "ai"|"user", text}
let currentTopic = null;

function tutorSystem(topic) {
  return `You are a friendly native English conversation partner for a Korean learner.
The current scene is: ${topic.scene}
Stay in that setting and keep the conversation consistent with it.
Speak natural, everyday English. Keep each message to 1-3 sentences and always end with something the learner can respond to (a question or an invitation to share).
You also review the learner's latest message:
- List grammar mistakes and unnatural (non-native) phrasings as corrections. Explain each reason briefly in Korean.
- If the message is already natural, return an empty corrections array and an empty natural_alternative.
- Score 0-100 (grammar + naturalness). A short but perfectly natural reply can still score high.
- Then continue the conversation naturally in "reply", reacting to what the learner said and staying in the scene.`;
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

function feedbackHTML({ corrections, natural_alternative, score }) {
  const good = (!corrections || corrections.length === 0) && !natural_alternative;
  return good
    ? `<div class="fb-title">✅ 자연스러워요! ${scoreBadge(score)}</div>`
    : `<div class="fb-title">📝 피드백 ${scoreBadge(score)}</div>
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
  appendRecord("sessions", { feature: "conversation", topicId: topic.id });
  $("#conv-messages").innerHTML = "";
  $("#conv-intro").classList.add("hidden");
  $("#conv-room").classList.remove("hidden");
  addScene(topic);
  convHistory.push({ role: "ai", text: topic.opening });
  addBubble("ai", topic.opening);
  $("#conv-input").focus();
}

async function reply(text) {
  const transcript = convHistory
    .map((m) => `${m.role === "user" ? "Learner" : "Partner"}: ${m.text}`)
    .join("\n");
  const result = await chatJSON({
    system: tutorSystem(currentTopic),
    messages: [
      {
        role: "user",
        content: `Conversation so far:\n${transcript}\n\nLearner's latest message: "${text}"`,
      },
    ],
    schema: REPLY_SCHEMA,
  });
  appendRecord("conversation", { score: result.score, sentence: text });
  return result;
}

export function init() {
  $("#conv-start").addEventListener("click", start);

  $("#conv-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = $("#conv-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
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
      typing.remove();
      toast(e.message);
    }
  });
}
