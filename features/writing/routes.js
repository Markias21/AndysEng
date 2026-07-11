import { Router } from "express";
import { chatText, chatJSON } from "../../shared/claude.js";
import { appendRecord } from "../../shared/store.js";

// 글쓰기 공부: AI가 질문 제시 → 유저가 3~4문장 논설문 작성 → 문법 첨삭 + 교정문 + 원어민 답안 + 표현 제시.
const router = Router();

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

router.post("/question", async (req, res, next) => {
  try {
    const question = await chatText({
      system:
        "You create short opinion-essay prompts for a Korean English learner. Output only the prompt itself in English (one or two sentences), answerable with a light argumentative answer of 3-4 sentences. Vary topics widely: society, technology, daily life, culture, education.",
      messages: [{ role: "user", content: "Give me one new essay prompt." }],
    });
    res.json({ question });
  } catch (err) {
    next(err);
  }
});

router.post("/review", async (req, res, next) => {
  try {
    const { question, answer } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: "question과 answer가 필요합니다." });
    }

    const result = await chatJSON({
      system: `You are an English writing tutor for a Korean learner. Review the learner's short opinion essay:
1. corrections: every grammar error and awkward phrasing, with the reason explained in Korean.
2. corrected_answer: the learner's own answer with only grammatical fixes applied (keep their voice and argument).
3. native_answer: the same argument rewritten as a fluent native speaker would write it (3-4 sentences).
4. native_expressions: 3-5 useful native-like expressions related to this topic or taken from the native answer, each with Korean meaning and an example sentence.
5. score: 0-100 for grammar, naturalness, and clarity.`,
      messages: [
        { role: "user", content: `Prompt: ${question}\n\nLearner's answer:\n${answer}` },
      ],
      schema: REVIEW_SCHEMA,
      maxTokens: 8192,
    });

    // 글쓰기는 피드백 전체를 따로 저장한다 (스펙 요구사항).
    appendRecord("writing", { score: result.score, question, answer, feedback: result });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
