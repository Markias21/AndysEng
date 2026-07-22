// 회화 공부: 카테고리(대학/연애/가치관/공부/직업/상담/취미/기타)를 골라 대화를 시작한다.
// 주제·페르소나는 로컬 데이터에서 뽑아 토큰을 아끼고, AI 호출은 턴별 첨삭/이어가기에만 쓴다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getRecords, getProfile, getRomanceMemory, setRomanceMemory } from "../../shared/store.js";
import { pickFresh } from "../../shared/pick.js";
import { scoreDetail, GRAMMAR_RUBRIC, NATURALNESS_NOTE } from "../../shared/scoring.js";
import { CONV_GUIDANCE, CEFR_SPEAKING_DESCRIPTORS, descriptorBlock } from "../../shared/levels.js";
import { autoSaveToGithub } from "../../shared/autosave.js";
import { takeTranslatorUses, TRANSLATOR_PENALTY } from "../../shared/translate.js";
import { CATEGORIES, HOBBY_SUBS, topicPool } from "./categories.js";
import { findPersona, oppositeGender, counselPersona } from "../../shared/personas.js";
import {
  $, esc, toast, scoreBreakdownHTML, rubricGuideHTML, correctionsHTML,
  spellingHTML, expressionAddHTML, wireExpressionAdds, translatorPenaltyHTML,
} from "../../shared/dom.js";

// 최근 이 개수만큼의 주제는 새로고침해도 다시 나오지 않게 피한다.
const RECENT_TOPICS = 20;

// 표현 수집 주기: 이만큼의 유저 턴마다 한 번 유용한 표현을 뽑아 복습 덱에 쌓는다(토큰 절약).
const EXTRACT_EVERY = 3;

// 취미 "자율": 파트너 오프닝 없이 플레이어가 먼저 화제를 꺼낸다.
const FREE_SCENE = "You and the learner are hanging out casually with nothing planned. They will bring up whatever's on their mind — a hobby, an interest, anything they enjoy.";
const FREE_PERSONA = "You are a friendly, curious peer chatting with the learner. The learner starts the conversation about a hobby or interest of their choice — follow their lead, react with genuine interest, and ask natural follow-up questions to keep it going.";

// 연애 대화가 끝날 때 저렴한 Haiku로 요약해 관계 기억을 갱신한다(사전·번역기와 같은 Haiku 고정 패턴).
const MEMORY_MODEL = "claude-haiku-4-5-20251001";
const MEMORY_SCHEMA = {
  type: "object",
  properties: {
    memory: { type: "string", description: "Updated relationship memory notes, under 400 characters" },
  },
  required: ["memory"],
  additionalProperties: false,
};

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
    spelling: {
      type: "array",
      description: "오타·대소문자·아포스트로피 실수만. 설명 없이 원문과 교정형만.",
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
    cefr_level: {
      type: "string",
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      description: "이 발화가 실제로 보여 주는 CEFR 레벨",
    },
    reply: { type: "string", description: "대화를 자연스럽게 이어가는 영어 답변, 1-3문장, 질문으로 끝내기" },
  };
  const required = ["spelling", "corrections", "natural_alternative", "grades", "cefr_level", "reply"];
  if (extract) {
    properties.expressions = { type: "array", items: EXPRESSION_ITEM };
    required.push("expressions");
  }
  return { type: "object", properties, required, additionalProperties: false };
}

const convHistory = []; // {role: "ai"|"user", text}
let currentSession = null; // {topicId, partnerId?, scene, opening, persona, memory?}
let currentCategory = null;
let currentSub = null;
let userTurns = 0;

// 시스템 프롬프트는 턴마다 절대 바뀌지 않아야 프롬프트 캐시가 유지된다.
// 표현 추출 지시처럼 턴마다 달라지는 내용은 여기 넣지 말고 유저 메시지 쪽(항상 캐시되지 않는 부분)에 넣는다.
// session.persona가 있으면(연애·상담·자율) 그 캐릭터를 연기하도록 지시를 함께 넣는다.
// session.memory(연애만)가 있으면 이전 대화에서 요약해 둔 관계 기억을 함께 준다.
function tutorSystem(session, level) {
  const personaBlock = session.persona
    ? `\n${session.persona}\nStay fully in character as this person throughout the conversation.` +
      (session.memory ? `\nWhat you remember about your relationship together so far: ${session.memory}` : "")
    : "";
  return `You are a friendly native English conversation partner for a Korean learner.
The current scene is: ${session.scene}${personaBlock}
Stay in that setting and keep the conversation consistent with it.
The learner's level is CEFR ${level}. Pitch your English to that level: ${CONV_GUIDANCE[level] || CONV_GUIDANCE.B1}.
Speak natural, everyday English. Keep each message to 1-3 sentences and always end with something the learner can respond to (a question or an invitation to share).
You also review the learner's latest message:
${GRAMMAR_RUBRIC}
${NATURALNESS_NOTE} This is a spoken conversation, so casual/spoken register is the natural fit here.
- spelling: list only typos, capitalization, and apostrophe slips as original -> corrected, with no explanation. Empty array if none.
- List real grammar mistakes and unnatural (non-native) phrasings as corrections (never typos, capitalization, or apostrophes). Explain each reason briefly in Korean.
- If the message is already natural, return an empty corrections array and an empty natural_alternative.
- Grade each rubric component S/A/B/C/F (S excellent, F poor): naturalness, grammar, structure (clarity of sentence structure). A short but perfectly natural reply can still earn S.
- cefr_level: the CEFR level this single message demonstrates. Pick the highest level whose speaking-skill descriptor the message fully meets (judge only this message, not the whole conversation):
${descriptorBlock(CEFR_SPEAKING_DESCRIPTORS)}
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

function feedbackHTML({ spelling, corrections, natural_alternative, grades, cefr_level, expressions, translatorUses, penalty, total }) {
  const good = (!corrections || corrections.length === 0) && !natural_alternative;
  return `<div class="fb-title">${good ? "✅ 자연스러워요!" : "📝 피드백"}${cefr_level ? ` <span class="cefr">이 발화 레벨: ${esc(cefr_level)}</span>` : ""}</div>
       ${scoreBreakdownHTML("conversation", grades)}
       ${translatorPenaltyHTML(translatorUses, penalty, total)}
       ${spelling?.length ? `<div class="fb-title">✏️ 오타·대소문자 <span class="reason">(점수에는 반영하지 않아요)</span></div>${spellingHTML(spelling)}` : ""}
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

// 연애 대화가 끝날 때(다른 세션으로 넘어가거나 카테고리 화면으로 나갈 때) 호출한다.
// 대화가 없었으면(userTurns=0) 아무것도 하지 않는다. 실패해도 학습 흐름을 막지 않도록 토스트만 띄운다.
async function updateRomanceMemory(partnerId) {
  const transcript = convHistory.map((m) => `${m.role === "user" ? "Learner" : "Partner"}: ${m.text}`).join("\n");
  if (!transcript) return;
  try {
    const { memory } = await chatJSON({
      system:
        "You maintain a short memory of an ongoing romantic relationship for a role-play conversation partner. " +
        "Given the previous memory and a new conversation excerpt, write an updated memory: merge in any new lasting " +
        "facts (preferences, feelings expressed, promises, plans, notable events) and drop anything no longer relevant. " +
        "Write compact notes, not a transcript. Keep it under 400 characters.",
      messages: [{
        role: "user",
        content: `Previous memory: ${getRomanceMemory(partnerId) || "(none yet)"}\n\nNew conversation:\n${transcript}`,
      }],
      schema: MEMORY_SCHEMA,
      modelOverride: MEMORY_MODEL,
      maxTokens: 300,
    });
    setRomanceMemory(partnerId, memory);
  } catch (e) {
    toast(`기억 저장 실패: ${e.message}`);
  }
}

// 세션을 떠나기 전 뒷정리: GitHub 자동 저장 + (연애라면) 관계 기억 갱신. beginSession과
// "다른 카테고리" 버튼 양쪽에서 공통으로 쓴다.
// 기억 요약은 논블로킹으로 실행해 화면 전환을 기다리게 하지 않는다. 갱신이 끝났을 때 마침
// 같은 상대와 새로고침해 다시 대화 중이라면(가장 흔한 경우) 그 자리에서 memory를 최신값으로
// 바꿔치기해, 이번 새로고침의 다음 턴부터 방금 요약된 기억이 반영되게 한다.
function persistLeavingSession() {
  if (!currentSession || userTurns === 0) return;
  const leaving = currentSession;
  const leavingCategory = currentCategory;
  autoSaveToGithub();
  if (leavingCategory !== "romance" || !leaving.partnerId) return;
  updateRomanceMemory(leaving.partnerId).then(() => {
    if (currentSession && currentSession.partnerId === leaving.partnerId) {
      currentSession.memory = getRomanceMemory(leaving.partnerId);
    }
  });
}

// 카테고리(+취미 하위)에서 대화 세션 설정을 만든다. 시작할 수 없으면 null.
function buildSession(category, sub) {
  if (category === "romance") {
    const { gender, romancePartnerId } = getProfile();
    const partner = findPersona(romancePartnerId);
    if (!partner || partner.gender !== oppositeGender(gender)) return null;
    return {
      topicId: `romance-${partner.id}`,
      partnerId: partner.id,
      scene: partner.scene,
      opening: partner.opening,
      persona: partner.persona,
      memory: getRomanceMemory(partner.id),
    };
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

// 실제로 대화 방을 열고 세션을 시작한다. reroll("다른 주제"/"새로고침")도 이 함수를 다시 부른다.
function beginSession(category, sub) {
  const session = buildSession(category, sub);
  if (!session) return toast("대화를 시작할 주제를 불러오지 못했습니다.");
  persistLeavingSession(); // 다른 세션으로 전환하기 전, 방금까지의 대화 기록을 저장해 둔다.
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
  const reroll = $("#conv-reroll");
  // 연애는 상대가 고정이라 "다른 주제"가 아니라 같은 상대와의 대화를 "새로고침"하는 동작이다.
  if (reroll) reroll.textContent = category === "romance" ? "🔄 새로고침" : "🔄 다른 주제";
  addScene(session.scene);
  if (session.opening) {
    convHistory.push({ role: "ai", text: session.opening });
    addBubble("ai", session.opening);
  } else {
    addStartHint();
  }
  $("#conv-input").focus();
}

// "🗂 다른 카테고리" 버튼: 현재 세션을 정리하고 카테고리 선택 화면(맨 처음)으로 돌아간다.
function backToCategories() {
  persistLeavingSession();
  currentSession = null;
  currentCategory = null;
  currentSub = null;
  convHistory.length = 0;
  userTurns = 0;
  $("#conv-room").classList.add("hidden");
  $("#conv-intro").classList.remove("hidden");
  renderCategories();
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
  appendRecord("conversation", { score: total, grades: result.grades, cefr: result.cefr_level, sentence: text, translatorUses });
  return { ...result, translatorUses, penalty, total };
}

export function init() {
  $("#conv-rubric").innerHTML = rubricGuideHTML("conversation");
  renderCategories();
  const reroll = $("#conv-reroll");
  if (reroll) reroll.addEventListener("click", () => beginSession(currentCategory, currentSub));
  const categoriesBtn = $("#conv-categories-btn");
  if (categoriesBtn) categoriesBtn.addEventListener("click", backToCategories);

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
