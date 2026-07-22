// 회화 공부: 카테고리(대학/연애/가치관/공부/직업/상담/취미/기타)를 골라 대화를 시작한다.
// 주제·페르소나는 로컬 데이터에서 뽑아 토큰을 아끼고, AI 호출은 턴별 첨삭/이어가기에만 쓴다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getRecords, getProfile } from "../../shared/store.js";
import { pickFresh } from "../../shared/pick.js";
import { scoreDetail } from "../../shared/scoring.js";
import { CONV_GUIDANCE } from "../../shared/levels.js";
import { autoSaveToGithub } from "../../shared/autosave.js";
import { takeTranslatorUses, TRANSLATOR_PENALTY } from "../../shared/translate.js";
import { CATEGORIES, HOBBY_SUBS, topicPool } from "./categories.js";
import { findPersona, oppositeGender, counselPersona } from "./personas.js";
import {
  $, esc, toast, scoreBreakdownHTML, rubricGuideHTML, correctionsHTML,
  expressionAddHTML, wireExpressionAdds, translatorPenaltyHTML,
} from "../../shared/dom.js";

// 최근 이 개수만큼의 주제는 새로고침해도 다시 나오지 않게 피한다.
const RECENT_TOPICS = 20;

// 표현 수집 주기: 이만큼의 유저 턴마다 한 번 유용한 표현을 뽑아 복습 덱에 쌓는다(토큰 절약).
const EXTRACT_EVERY = 3;

// 취미 "자율": 파트너 오프닝 없이 플레이어가 먼저 화제를 꺼낸다.
const FREE_SCENE = "You and the learner are hanging out casually with nothing planned. They will bring up whatever's on their mind — a hobby, an interest, anything they enjoy.";
const FREE_PERSONA = "You are a friendly, curious peer chatting with the learner. The learner starts the conversation about a hobby or interest of their choice — follow their lead, react with genuine interest, and ask natural follow-up questions to keep it going.";

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
let currentSession = null; // {topicId, scene, opening, persona}
let currentCategory = null;
let currentSub = null;
let userTurns = 0;

// 시스템 프롬프트는 턴마다 절대 바뀌지 않아야 프롬프트 캐시가 유지된다.
// 표현 추출 지시처럼 턴마다 달라지는 내용은 여기 넣지 말고 유저 메시지 쪽(항상 캐시되지 않는 부분)에 넣는다.
// session.persona가 있으면(연애·상담·자율) 그 캐릭터를 연기하도록 지시를 함께 넣는다.
function tutorSystem(session, level) {
  const personaBlock = session.persona
    ? `\n${session.persona}\nStay fully in character as this person throughout the conversation.`
    : "";
  return `You are a friendly native English conversation partner for a Korean learner.
The current scene is: ${session.scene}${personaBlock}
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

function addScene(scene) {
  const el = document.createElement("div");
  el.className = "scene-card";
  el.innerHTML = `<span class="scene-label">🎬 Scene</span><p>${esc(scene)}</p>`;
  $("#conv-messages").appendChild(el);
}

// 자율 모드: 파트너가 먼저 말하지 않으니 유저에게 먼저 시작하라고 안내한다.
function addStartHint() {
  const el = document.createElement("div");
  el.className = "start-hint";
  el.textContent = "🎤 당신이 먼저 이야기를 시작해 보세요.";
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

function feedbackHTML({ corrections, natural_alternative, grades, expressions, translatorUses, penalty, total }) {
  const good = (!corrections || corrections.length === 0) && !natural_alternative;
  return `<div class="fb-title">${good ? "✅ 자연스러워요!" : "📝 피드백"}</div>
       ${scoreBreakdownHTML("conversation", grades)}
       ${translatorPenaltyHTML(translatorUses, penalty, total)}
       ${correctionsHTML(corrections)}
       ${natural_alternative ? `<div>💬 원어민이라면: <span class="fixed">${esc(natural_alternative)}</span></div>` : ""}
       ${expressions?.length ? `<div class="fb-title">💡 익혀두면 좋은 표현</div>${expressionAddHTML(expressions)}` : ""}`;
}

function attachFeedback(turn, result) {
  const good = (!result.corrections || result.corrections.length === 0) && !result.natural_alternative;
  const el = document.createElement("div");
  el.className = `feedback ${good ? "good" : ""}`;
  el.innerHTML = feedbackHTML(result);
  if (result.expressions?.length) wireExpressionAdds(el, result.expressions, "conversation");
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

// 카테고리(+취미 하위)에서 대화 세션 설정을 만든다. 시작할 수 없으면 null.
function buildSession(category, sub) {
  if (category === "romance") {
    const { gender, romancePartnerId } = getProfile();
    const partner = findPersona(romancePartnerId);
    if (!partner || partner.gender !== oppositeGender(gender)) return null;
    return { topicId: `romance-${partner.id}`, scene: partner.scene, opening: partner.opening, persona: partner.persona };
  }
  if (category === "counsel") {
    const scene = pickFresh(counselPersona.scenes, recentTopicIds(), (s) => s.id);
    if (!scene) return null;
    return { topicId: scene.id, scene: scene.scene, opening: scene.opening, persona: counselPersona.persona };
  }
  if (category === "hobby" && sub === "free") {
    return { topicId: "hobby-free", scene: FREE_SCENE, opening: "", persona: FREE_PERSONA };
  }
  const topic = pickFresh(topicPool(category, sub), recentTopicIds(), (t) => t.id);
  if (!topic) return null;
  return { topicId: topic.id, scene: topic.scene, opening: topic.opening, persona: "" };
}

// 실제로 대화 방을 열고 세션을 시작한다. reroll("다른 주제")도 이 함수를 다시 부른다.
function beginSession(category, sub) {
  const session = buildSession(category, sub);
  if (!session) return toast("대화를 시작할 주제를 불러오지 못했습니다.");
  // 다른 주제로 전환하기 전, 방금까지의 대화 기록을 GitHub에 저장해 둔다.
  if (currentSession && userTurns > 0) autoSaveToGithub();
  takeTranslatorUses("conversation"); // 이전 대화에서 남은 번역기 사용 기록은 새 대화로 넘기지 않는다.
  currentSession = session;
  currentCategory = category;
  currentSub = sub;
  convHistory.length = 0;
  userTurns = 0;
  appendRecord("sessions", { feature: "conversation", topicId: session.topicId, category });
  $("#conv-messages").innerHTML = "";
  $("#conv-intro").classList.add("hidden");
  $("#conv-room").classList.remove("hidden");
  addScene(session.scene);
  if (session.opening) {
    convHistory.push({ role: "ai", text: session.opening });
    addBubble("ai", session.opening);
  } else {
    addStartHint();
  }
  $("#conv-input").focus();
}

// 카테고리 버튼을 누르면: 취미는 하위 선택으로, 연애는 설정 확인 후, 나머지는 바로 시작.
function startFromCategory(category) {
  if (category === "hobby") return renderHobbySubs();
  if (category === "romance") {
    const { gender, romancePartnerId } = getProfile();
    const partner = findPersona(romancePartnerId);
    if (!partner || partner.gender !== oppositeGender(gender)) {
      return toast("설정 ⚙️ 에서 내 성별과 연애 상대를 먼저 정해 주세요.");
    }
  }
  beginSession(category, null);
}

function renderCategories() {
  const grid = $("#conv-categories");
  grid.innerHTML = CATEGORIES.map(
    (c) => `<button class="btn-secondary category-btn" type="button" data-cat="${c.id}">${esc(c.label)}</button>`
  ).join("");
  grid.querySelectorAll("[data-cat]").forEach((b) =>
    b.addEventListener("click", () => startFromCategory(b.dataset.cat))
  );
}

function renderHobbySubs() {
  const grid = $("#conv-categories");
  grid.innerHTML =
    `<button class="btn-text sub-back" type="button">← 카테고리</button>` +
    HOBBY_SUBS.map(
      (s) => `<button class="btn-secondary category-btn" type="button" data-sub="${s.id}">${esc(s.label)}</button>`
    ).join("");
  grid.querySelector(".sub-back").addEventListener("click", renderCategories);
  grid.querySelectorAll("[data-sub]").forEach((b) =>
    b.addEventListener("click", () => beginSession("hobby", b.dataset.sub))
  );
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
    system: [{ type: "text", text: tutorSystem(currentSession, level), cache_control: { type: "ephemeral" } }],
    messages: buildMessages(text, extractCount),
    schema: buildReplySchema(extractCount > 0),
  });
  const rawTotal = scoreDetail("conversation", result.grades).total;
  const translatorUses = takeTranslatorUses("conversation");
  const penalty = translatorUses * TRANSLATOR_PENALTY.conversation;
  const total = Math.max(0, rawTotal - penalty);
  appendRecord("conversation", { score: total, grades: result.grades, sentence: text, translatorUses });
  return { ...result, translatorUses, penalty, total };
}

export function init() {
  $("#conv-rubric").innerHTML = rubricGuideHTML("conversation");
  renderCategories();
  const reroll = $("#conv-reroll");
  if (reroll) reroll.addEventListener("click", () => beginSession(currentCategory, currentSub));

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
