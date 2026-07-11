import { Router } from "express";
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getRecords } from "../../shared/store.js";

// 표현 공부: 표현 하나 제시 → 유저가 예문 작성 → 첨삭/채점 → 다음 표현.
const router = Router();

const EXPRESSION_SCHEMA = {
  type: "object",
  properties: {
    expression: { type: "string" },
    meaning: { type: "string", description: "뜻을 한국어로" },
    example: { type: "string", description: "영어 예문 하나" },
  },
  required: ["expression", "meaning", "example"],
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

router.post("/next", async (req, res, next) => {
  try {
    const recent = getRecords("expression").slice(-30).map((r) => r.expression);
    const result = await chatJSON({
      system:
        "You teach useful, high-frequency native English expressions (idioms, phrasal verbs, collocations) to a Korean intermediate learner. Give exactly one expression with its Korean meaning and one natural example sentence.",
      messages: [
        {
          role: "user",
          content: recent.length
            ? `Give me one new expression. Do NOT repeat any of these: ${recent.join(", ")}`
            : "Give me one new expression.",
        },
      ],
      schema: EXPRESSION_SCHEMA,
      maxTokens: 1024,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/review", async (req, res, next) => {
  try {
    const { expression, sentence } = req.body;
    if (!expression || !sentence) {
      return res.status(400).json({ error: "expression과 sentence가 필요합니다." });
    }

    const result = await chatJSON({
      system: `You review a Korean learner's example sentence using the target expression "${expression}".
- corrections: grammar errors and unnatural phrasings, reasons in Korean.
- natural_version: how a native speaker would write the same idea using the expression.
- comment: one or two sentences in Korean on whether the expression was used correctly.
- score: 0-100 (grammar, naturalness, and correct use of the expression).`,
      messages: [{ role: "user", content: `Learner's sentence: "${sentence}"` }],
      schema: REVIEW_SCHEMA,
    });

    appendRecord("expression", { score: result.score, expression, sentence });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
