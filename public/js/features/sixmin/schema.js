// 리스닝 AI 응답 스키마. 값이 상수뿐이라 로직 없이 여기 모아 둔다.
import { QUESTION_TYPE_IDS } from "./types.js";

/**
 * 에피소드 하나에 대한 문제 세트. 에피소드당 한 번만 만들고 영구 캐시하므로 이 호출은 평생 1회다.
 * 정답 키를 함께 받아 두므로 채점은 shared/mcq.js에서 전부 로컬로 끝난다(재도전 0원).
 *
 * 리딩과 달리 표현 빈칸·요약 체크리스트는 받지 않는다 — 이 화면의 인출 훈련은 받아쓰기가 맡고,
 * 어휘는 BBC가 대본 PDF에 직접 붙여 준 것을 쓴다(AI 0원).
 */
export const GENERATE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      description: "Exactly 5 questions, each of a different type.",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: QUESTION_TYPE_IDS },
          stem: { type: "string", description: "The question, in English." },
          options: { type: "array", description: "Exactly four options.", items: { type: "string" } },
          answer: { type: "integer", description: "Index (0-3) of the correct option." },
          evidence: {
            type: "string",
            description: "The line from the transcript that justifies the answer, copied exactly.",
          },
          explanation_ko: { type: "string", description: "One or two short Korean sentences: why that option is right." },
        },
        required: ["type", "stem", "options", "answer", "evidence", "explanation_ko"],
        additionalProperties: false,
      },
    },
    summary_ko: {
      type: "string",
      description: "Two or three Korean sentences summarising the episode, shown only after answering.",
    },
  },
  required: ["questions", "summary_ko"],
  additionalProperties: false,
};
