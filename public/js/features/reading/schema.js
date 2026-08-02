// 리딩 AI 응답 스키마. 값이 상수뿐이라 로직 없이 여기 모아 둔다.
import { GRADES } from "../../shared/scoring.js";
import { QUESTION_TYPE_IDS } from "./types.js";

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];

/**
 * 지문 하나에 대한 문제 세트. 지문당 한 번만 만들고 영구 캐시하므로 이 호출은 평생 1회다.
 *
 * 토큰을 아끼려고 일부러 넣지 않은 것들:
 *  - 빈칸이 들어 있는 영어 문장 → 표현만 받아 지문에서 되찾는다(passage.resolveBlanks).
 *  - 요약 모범 답안 → 채점 때 학습자 답을 보고 만드는 편이 쓸모 있어 채점 응답에만 있다.
 */
export const GENERATE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      description: "Exactly 4 or 5 questions, each of a different type.",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: QUESTION_TYPE_IDS },
          stem: { type: "string", description: "The question, in English." },
          options: { type: "array", description: "Exactly four options.", items: { type: "string" } },
          answer: { type: "integer", description: "Index (0-3) of the correct option." },
          evidence: { type: "string", description: "The sentence from the passage that justifies the answer, copied exactly." },
          explanation_ko: { type: "string", description: "One or two short Korean sentences: why that option is right." },
        },
        required: ["type", "stem", "options", "answer", "evidence", "explanation_ko"],
        additionalProperties: false,
      },
    },
    blanks: {
      type: "array",
      description: "3 to 5 expressions.",
      items: {
        type: "object",
        properties: {
          expression: { type: "string", description: "A word or collocation copied EXACTLY from the passage." },
          meaning: { type: "string", description: "Korean meaning in this context." },
          sentence_ko: { type: "string", description: "Korean translation of the passage sentence containing it." },
          level: { type: "string", enum: CEFR },
          non_literal: { type: "boolean", description: "True if a Korean speaker would not arrive at this wording by direct translation." },
        },
        required: ["expression", "meaning", "sentence_ko", "level", "non_literal"],
        additionalProperties: false,
      },
    },
    key_points: {
      type: "array",
      description: "The 3 to 6 points a good summary must contain. Kept for grading so the passage need not be resent.",
      items: { type: "string" },
    },
    main_idea: { type: "string", description: "The passage's main idea in one English sentence." },
    restate_sentence: {
      type: "string",
      description: "One meaty sentence copied EXACTLY from the passage for the learner to restate.",
    },
  },
  required: ["questions", "blanks", "key_points", "main_idea", "restate_sentence"],
  additionalProperties: false,
};

const gradeField = (label) => ({ type: "string", enum: GRADES, description: label });

/**
 * 요약·재진술 채점. 지문 전체 대신 생성 때 받아 둔 key_points·main_idea만 보내므로
 * 입력 토큰이 지문을 그대로 보낼 때의 1/6 수준이다.
 */
export const GRADE_SCHEMA = {
  type: "object",
  properties: {
    grades: {
      type: "object",
      properties: {
        task: gradeField("Faithfulness to the passage."),
        accuracy: gradeField("Grammatical accuracy."),
        range: gradeField("Paraphrase — own words rather than copying."),
        fluency: gradeField("Flow and cohesion."),
      },
      required: ["task", "accuracy", "range", "fluency"],
      additionalProperties: false,
    },
    // 항목 문구는 이미 로컬에 있으므로 되돌려받지 않는다 — 순서만 맞춘 불리언 배열로 출력 토큰을 아낀다.
    covered: {
      type: "array",
      description: "One true/false per key point, in the same order as the numbered list given.",
      items: { type: "boolean" },
    },
    inaccuracies: {
      type: "array",
      description: "Claims the learner made that the passage does not support. Empty if none.",
      items: { type: "string", description: "Korean: what was wrong and what the passage actually said." },
    },
    corrections: {
      type: "array",
      description: "Grammar fixes only. Never typos or capitalization.",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          reason: { type: "string", description: "Korean, one short sentence." },
        },
        required: ["original", "corrected", "reason"],
        additionalProperties: false,
      },
    },
    spelling: {
      type: "array",
      description: "Typos and capitalization only. Never affects any grade.",
      items: {
        type: "object",
        properties: { original: { type: "string" }, corrected: { type: "string" } },
        required: ["original", "corrected"],
        additionalProperties: false,
      },
    },
    model_summary: {
      type: "array",
      description: "A model summary at the learner's CEFR level, one entry per sentence.",
      items: {
        type: "object",
        properties: {
          sentence: { type: "string" },
          translation: { type: "string", description: "Korean translation." },
        },
        required: ["sentence", "translation"],
        additionalProperties: false,
      },
    },
    model_restatement: { type: "string", description: "A model restatement of the given sentence. Empty string if the learner skipped it." },
    comment: { type: "string", description: "Korean, 2-3 sentences: the overall verdict and the single most useful thing to fix." },
  },
  required: ["grades", "covered", "inaccuracies", "corrections", "spelling", "model_summary", "model_restatement", "comment"],
  additionalProperties: false,
};
