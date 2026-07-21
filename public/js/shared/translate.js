// 외부 서비스(Claude API) 경계 — 번역기. 한국어 문장을 자연스러운 영어로 바꿔준다.
// 사전과 마찬가지로 Haiku 고정(빠르고 저렴). 자유 문장이라 재사용 가치가 낮아 캐시는 하지 않는다.
import { chatJSON } from "./claude.js";

const TRANSLATE_MODEL = "claude-haiku-4-5-20251001";

// 번역기를 한 번 쓸 때마다 그 기능의 판정에서 깎이는 점수.
export const TRANSLATOR_PENALTY = { writing: 5, conversation: 10 };

const SCHEMA = {
  type: "object",
  properties: { english: { type: "string", description: "자연스러운 영어 번역 한 문장" } },
  required: ["english"],
  additionalProperties: false,
};

export async function translateToEnglish(korean) {
  const { english } = await chatJSON({
    system: "You translate a Korean sentence into natural, everyday spoken English for a Korean English learner. Return only the single best natural translation.",
    messages: [{ role: "user", content: korean }],
    schema: SCHEMA,
    modelOverride: TRANSLATE_MODEL,
    maxTokens: 512,
  });
  return english;
}

// 기능별 번역기 사용 횟수. 판정 시점(글쓰기 제출/회화 턴 전송)에 꺼내 쓰고 그 즉시 0으로 되돌린다.
const uses = { writing: 0, conversation: 0 };

export function recordTranslatorUse(feature) {
  uses[feature] += 1;
}

export function takeTranslatorUses(feature) {
  const n = uses[feature];
  uses[feature] = 0;
  return n;
}
