// 복습 예문 첨삭에 쓰는 응답 스키마와 시스템 프롬프트. 상수와 순수 함수만.
// 첨삭은 피드백 전용이고 다음 복습 시점에는 영향을 주지 않는다(자가평가가 정한다).
import { GRADES, GRADE_SCALE_NOTE, GRAMMAR_RUBRIC, NATURALNESS_NOTE, RANGE_RUBRIC } from "../../shared/scoring.js";

export const REVIEW_SCHEMA = {
  type: "object",
  properties: {
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
          reason: { type: "string", description: "이유를 한국어로" },
        },
        required: ["original", "corrected", "reason"],
        additionalProperties: false,
      },
    },
    natural_version: { type: "string", description: "원어민이라면 이렇게 쓸 문장" },
    comment: { type: "string", description: "표현을 제대로 활용했는지 한국어로 한두 문장" },
    grades: {
      type: "object",
      description: "각 배점 요소를 9단계(S+~F) 절대 기준으로 채점",
      properties: {
        task: { type: "string", enum: GRADES },
        accuracy: { type: "string", enum: GRADES },
        range: { type: "string", enum: GRADES },
        fluency: { type: "string", enum: GRADES },
      },
      required: ["task", "accuracy", "range", "fluency"],
      additionalProperties: false,
    },
  },
  required: ["spelling", "corrections", "natural_version", "comment", "grades"],
  additionalProperties: false,
};

/** 표현/단어 예문 채점용 시스템 프롬프트. */
export function reviewSystem(kind, term) {
  const noun = kind === "word" ? "word" : "expression";
  return `You review a Korean learner's example sentence using the target ${noun} "${term}".
- spelling: list only typos, capitalization, and apostrophe slips as original -> corrected, with no explanation. Empty array if none.
- corrections: real grammar errors and unnatural phrasings only (never typos, capitalization, or apostrophes), reasons in Korean.
- natural_version: how a native speaker would write the same idea using the ${noun}.
- comment: one or two sentences in Korean on whether it was used correctly. The learner was asked to write about their own real life, so if the sentence is impersonal or generic, say so briefly.
- grades: grade the sentence on four independent components, judged separately.
${GRADE_SCALE_NOTE}
- task: how accurately and meaningfully the sentence uses the target ${noun} to convey its real meaning (an off-target or nonsensical use scores low even if grammatical).
- accuracy: ${GRAMMAR_RUBRIC}
- range: ${RANGE_RUBRIC}
- fluency: ${NATURALNESS_NOTE}`;
}
