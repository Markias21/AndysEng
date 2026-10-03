// 첨삭 AI 호출과 기록 저장. 화면은 건드리지 않는다.
//
// 호출과 저장을 한 함수가 같이 하면 다시 쓰기(rewriteOf/stage를 붙여 저장해야 한다)에서 쓸 수 없어
// ui.js에서 떼어 냈다. 저장된 기록(rid 포함)을 그대로 돌려주므로 호출자가 다시 쓰기를 예약할 수 있다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getProfile } from "../../shared/store.js";
import { scoreDetail } from "../../shared/scoring.js";
import { takeTranslatorUses, TRANSLATOR_PENALTY } from "../../shared/translate.js";
import { REVIEW_SCHEMA, EMAIL_REVIEW_SCHEMA } from "./schema.js";
import { discussionSystem, emailSystem } from "./review-prompt.js";

/** 번역기 사용 횟수만큼 깎은 최종 점수. 0 미만은 0으로. */
function applyPenalty(feature, grades) {
  const rawTotal = scoreDetail(feature, grades).total;
  const translatorUses = takeTranslatorUses("writing");
  const penalty = translatorUses * TRANSLATOR_PENALTY.writing;
  return { translatorUses, penalty, total: Math.max(0, rawTotal - penalty) };
}

/**
 * 토론형 첨삭. extra는 기록에 그대로 덧붙는다(다시 쓰기면 { rewriteOf, stage }).
 * → { ...AI 응답, translatorUses, penalty, total, record }
 */
export async function reviewDiscussion(question, answer, extra = {}) {
  const result = await chatJSON({
    system: discussionSystem(getProfile().level),
    messages: [{ role: "user", content: `Prompt: ${question}\n\nLearner's answer:\n${answer}` }],
    schema: REVIEW_SCHEMA,
    maxTokens: 8192,
  });
  const scored = applyPenalty("writing", result.grades);
  const record = appendRecord("writing", {
    mode: "discussion",
    score: scored.total,
    grades: result.grades,
    cefr: result.cefr_level,
    toefl: result.toefl_score,
    question,
    answer,
    feedback: result,
    translatorUses: scored.translatorUses,
    ...extra,
  });
  return { ...result, ...scored, record };
}

/** 이메일 첨삭. 인자 규약은 reviewDiscussion과 같다. */
export async function reviewEmail(promptData, answer, extra = {}) {
  const result = await chatJSON({
    system: emailSystem(getProfile().level, promptData),
    messages: [{ role: "user", content: `Learner's email draft:\n${answer}` }],
    schema: EMAIL_REVIEW_SCHEMA,
    maxTokens: 8192,
  });
  const scored = applyPenalty("email", result.grades);
  const record = appendRecord("writing", {
    mode: "email",
    promptId: promptData.id,
    score: scored.total,
    grades: result.grades,
    cefr: result.cefr_level,
    toefl: result.toefl_score,
    question: promptData.situation,
    answer,
    feedback: result,
    translatorUses: scored.translatorUses,
    ...extra,
  });
  return { ...result, ...scored, record };
}
