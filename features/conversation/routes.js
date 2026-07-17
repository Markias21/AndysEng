import { Router } from "express";
import { chatText, chatJSON } from "../../shared/claude.js";
import { appendRecord } from "../../shared/store.js";

// 회화 공부: AI가 먼저 말을 걸고, 유저 답변마다 자연스러움/문법 피드백 후 대화를 이어간다.
const router = Router();

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

router.post("/start", async (req, res, next) => {
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
    });
    res.json({ message });
  } catch (err) {
    next(err);
  }
});

router.post("/reply", async (req, res, next) => {
  try {
    const { history, userMessage } = req.body;
    if (!userMessage) return res.status(400).json({ error: "userMessage가 필요합니다." });

    const transcript = (history || [])
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
          content: `Conversation so far:\n${transcript}\n\nLearner's latest message: "${userMessage}"`,
        },
      ],
      schema: REPLY_SCHEMA,
    });

    appendRecord(req.user.id, "conversation", { score: result.score, sentence: userMessage });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
