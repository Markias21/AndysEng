// 문단 연습(produce 타입) AI 채점 스키마. 문단 하나짜리 과제라 리딩의 4축 등급(S~F) 대신
// 대폭 단순화한 pass/fail + 짧은 피드백만 받는다 — 토큰을 최소화하려는 의도.
export const PRODUCE_GRADE_SCHEMA = {
  type: "object",
  properties: {
    good: {
      type: "boolean",
      description: "True if the learner's response faithfully captures the paragraph's meaning in their own words, in reasonably correct English.",
    },
    feedback_ko: { type: "string", description: "One or two short Korean sentences of feedback — what was good or what to fix." },
    model_answer: { type: "string", description: "A brief native-level model restatement/summary, in English, at the learner's CEFR level." },
  },
  required: ["good", "feedback_ko", "model_answer"],
  additionalProperties: false,
};
