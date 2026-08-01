// 글쓰기 기본용 모범 답안 12편의 집계. 각 지문은 250~300단어 분량의 토플 수준 논설문이고,
// 형식은 { id, template(templates.js의 id), prompt(writing/prompts.js와 동일한 문자열), titleKo,
//          sentences: [{sentence, translation}], blanks: [{expression, meaning, level(1~3)}] }.
// template별 파일로 나눈 이유는 conversation/hobby-topics.js와 같은 이유 — 한 파일이 너무 길어지는 것을 막기 위함.
import { preferenceEssays } from "./essays-preference.js";
import { agreeEssays } from "./essays-agree.js";
import { tradeoffEssays } from "./essays-tradeoff.js";
import { policyEssays } from "./essays-policy.js";

export const ESSAYS = [...preferenceEssays, ...agreeEssays, ...tradeoffEssays, ...policyEssays];

export function findEssay(id) {
  return ESSAYS.find((e) => e.id === id) || null;
}

export function essaysOf(templateId) {
  return ESSAYS.filter((e) => e.template === templateId);
}
