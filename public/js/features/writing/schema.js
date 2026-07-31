// 글쓰기 AI 호출의 응답 스키마. 데이터 정의만 두고 호출·렌더링은 ui.js가 맡는다.
import { GRADES } from "../../shared/scoring.js";

// 답안은 문장 단위로 받아 한 줄씩 보여 주고, 각 문장의 한국어 해석을 함께 붙인다.
// 고친 부분·새로 쓴 중요한 표현은 [[...]]로 감싸 밑줄로 렌더한다.
const SENTENCE_ITEM = {
  type: "object",
  properties: {
    sentence: { type: "string", description: "영어 문장 한 개. 고친 부분이나 새로 쓴 중요한 표현은 [[...]]로 감쌀 것" },
    translation: { type: "string", description: "이 문장의 한국어 해석" },
  },
  required: ["sentence", "translation"],
  additionalProperties: false,
};

export const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    spelling: {
      type: "array",
      description: "오타·대소문자 실수만. 설명 없이 원문과 교정형만.",
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
          reason: { type: "string", description: "이유를 한국어로 설명" },
        },
        required: ["original", "corrected", "reason"],
        additionalProperties: false,
      },
    },
    corrected_answer: { type: "array", items: SENTENCE_ITEM, description: "문법적으로 맞게 고친 답안, 문장 단위" },
    native_answer: { type: "array", items: SENTENCE_ITEM, description: "원어민이 쓴 것처럼 다듬은 모범 답안, 문장 단위" },
    native_expressions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          expression: { type: "string" },
          meaning: { type: "string", description: "뜻을 한국어로" },
          example: { type: "string" },
          example_ko: { type: "string", description: "example의 한국어 해석" },
          level: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"], description: "이 표현의 CEFR 난이도" },
          non_literal: { type: "boolean", description: "한국어를 그대로 직역해서는 나오지 않는 표현이면 true" },
        },
        required: ["expression", "meaning", "example", "example_ko", "level", "non_literal"],
        additionalProperties: false,
      },
    },
    cefr_level: {
      type: "string",
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      description: "이 글의 전체 품질(구체성·분량·문법·표현)로 매긴 CEFR 레벨",
    },
    toefl_score: {
      type: "integer",
      enum: [0, 1, 2, 3, 4],
      description: "토플 라이팅 밴드(0~4)로 매긴 홀리스틱 점수",
    },
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
  required: ["spelling", "corrections", "corrected_answer", "native_answer", "native_expressions", "cefr_level", "toefl_score", "grades"],
  additionalProperties: false,
};

export const QNA_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string", description: "학생의 질문에 대한 한국어 답변" },
  },
  required: ["answer"],
  additionalProperties: false,
};
