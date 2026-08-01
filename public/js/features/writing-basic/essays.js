// 글쓰기 기본용 모범 답안 40편의 집계. 형식은
// { id, template(templates.js의 id), prompt, titleKo,
//   sentences: [{sentence, translation}], blanks: [{expression, meaning, level(1~3)}] }.
// 토론형(discussion) 지문은 250~300단어 + prompt가 writing/prompts.js의 문자열과 동일해야 한다.
// 이메일(email) 지문은 110~160단어 + bullets(요구된 3개 항목)를 추가로 갖는다.
// template별 파일로 나눈 이유는 conversation/hobby-topics.js와 같은 이유 — 한 파일이 너무 길어지는 것을 막기 위함.
import { preferenceEssays } from "./essays-preference.js";
import { agreeEssays } from "./essays-agree.js";
import { tradeoffEssays } from "./essays-tradeoff.js";
import { policyEssays } from "./essays-policy.js";
import { emailEssays } from "./essays-email.js";
import { findTemplate } from "./templates.js";

export const ESSAYS = [...preferenceEssays, ...agreeEssays, ...tradeoffEssays, ...policyEssays, ...emailEssays];

export function findEssay(id) {
  return ESSAYS.find((e) => e.id === id) || null;
}

export function essaysOf(templateId) {
  return ESSAYS.filter((e) => e.template === templateId);
}

/** 이 모드(discussion|email)에 속하는 지문 전체 — templates.js의 mode를 통해 간접 조회한다. */
export function essaysOfMode(mode) {
  return ESSAYS.filter((e) => findTemplate(e.template)?.mode === mode);
}
