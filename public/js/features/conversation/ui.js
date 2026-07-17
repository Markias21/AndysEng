// 회화 공부: AI가 먼저 말을 걸고, 유저 답변마다 자연스러움/문법 피드백 후 대화를 이어간다.
import { chatText, chatJSON } from "../../shared/claude.js";
import { appendRecord } from "../../shared/store.js";
import { $, esc, toast, scoreBadge, correctionsHTML } from "../../shared/dom.js";

const TUTOR_SYSTEM = `You are a friendly native English conversation partner for a Korean learner.
Speak natural, everyday English. Keep each message to 1-3 sentences and always end with something the learner can respond to (a question or an invitation to share).
Vary topics: daily life, hobbies, opinions, hypotheticals. Do not correct the learner here — another step handles corrections.`;

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

function addBubble(role, text) {
  const el = document.createElement("div");
  el.className = `bubble ${role}`;
  el.textContent = text;
  $("#conv-messages").appendChild(el);
  el.scrollIntoView({ behavior: "smooth", block: "end" });
  return el;
}

function addFeedback({ corrections, natural_alternative, score }) {
  const el = document.createElement("div");
  const good = (!corrections || corrections.length === 0) && !natural_alternative;
  el.className = `feedback ${good ? "good" : ""}`;
  el.innerHTML = good
    ? `<div class="fb-title">✅ 자연스러운 표현이에요! ${scoreBadge(score)}</div>`
    : `<div class="fb-title">📝 피드백 ${scoreBadge(score)}</div>
       ${correctionsHTML(corrections)}
       ${natural_alternative ? `<div>💬 원어민이라면: <span class="fixed">${esc(natural_alternative)}</span></div>` : ""}`;
  $("#conv-messages").appendChild(el);
  el.scrollIntoView({ behavior: "smooth", block: "end" });
}

async function start() {
  const btn = $("#conv-start");
  btn.disabled = true;
  try {
    const message = await chatText({
      system: TUTOR_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            "Start a new casual conversation with me. Pick a random everyday topic and open with a short greeting plus a question.",
        },
      ],
      maxTokens: 300,
    });
    appendRecord("sessions", { feature: "conversation" });
    $("#conv-intro").classList.add("hidden");
    $("#conv-room").classList.remove("hidden");
    convHistory.push({ role: "ai", text: message });
    addBubble("ai", message);
    $("#conv-input").focus();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

async function reply(text) {
  const transcript = convHistory
    .map((m) => `${m.role === "user" ? "Learner" : "Partner"}: ${m.text}`)
    .join("\n");
  const result = await chatJSON({
    system: `${TUTOR_SYSTEM}

You also review the learner's latest message:
- List grammar mistakes and unnatural (non-native) phrasings as corrections. Explain each reason briefly in Korean.
- If the message is already natural, return an empty corrections array and an empty natural_alternative.
- Score 0-100 (grammar + naturalness). A short but perfectly natural reply can still score high.
- Then continue the conversation naturally in "reply", reacting to what the learner said.`,
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
    addBubble("user", text);
    const typing = addBubble("ai typing", "생각 중...");
    try {
      const result = await reply(text);
      convHistory.push({ role: "user", text });
      typing.remove();
      addFeedback(result);
      convHistory.push({ role: "ai", text: result.reply });
      addBubble("ai", result.reply);
    } catch (e) {
      typing.remove();
      toast(e.message);
    }
  });
}
