// 리스닝 AI 호출의 시스템 프롬프트 빌더. 순수 문자열 조립만 — DOM/저장소를 import하지 않는다.
import { QUESTION_TYPES } from "./types.js";

const typeMenu = QUESTION_TYPES.map((t) => `- ${t.id}: ${t.prompt}`).join("\n");

/**
 * 문제 세트 생성 프롬프트. 에피소드당 평생 한 번만 호출되고 결과는 영구 캐시된다.
 * 4지선다로 뽑는 이유는 정답 키만 있으면 이후 채점이 전부 로컬에서 끝나기 때문이다(재도전 무료).
 */
export function generateSystem(level) {
  return `You are a TOEFL iBT Listening item writer. You will be given the transcript of one BBC 6 Minute English episode — a scripted radio discussion between two presenters, usually with clips from guests. Write practice items for a Korean learner whose target level is CEFR ${level}.

The learner answers these AFTER listening, with the transcript in front of them. Everything you produce must be answerable from the transcript alone. Never rely on outside knowledge.

1. questions: write exactly 5 multiple-choice questions in the style of the TOEFL iBT Listening section. Use a DIFFERENT type for each question, chosen from:
${typeMenu}
Rules for every question:
- Exactly four options. Exactly one is defensible; the other three must be clearly wrong to a careful listener, but tempting to a careless one (use real wording from the episode in wrong options rather than inventing unrelated ideas).
- Order the questions to follow the episode from beginning to end.
- Do NOT ask about the vocabulary definitions the programme itself spells out at the end — that part is already given to the learner.
- evidence: copy, word for word, the one line from the transcript that settles the answer.
- explanation_ko: one or two short Korean sentences saying why the answer is right. Be brief — this is read after answering.

2. summary_ko: 2-3 Korean sentences summarising what the episode was about and what the two sides of the discussion were. This is shown after answering so the learner can check their overall understanding.`;
}
