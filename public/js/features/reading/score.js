// 리딩 객관식·빈칸 채점 도메인 로직. 순수 함수만 — UI/저장소/AI를 import하지 않는다.
//
// 토플 리딩 문항은 전부 4지선다라, 문제를 만들 때 받아 둔 정답 키만 있으면 채점은 여기서 끝난다.
// 그래서 지문을 한 번 열어 문제를 만든 뒤에는 몇 번을 다시 풀어도 AI 호출이 0회다.
import { checkWords } from "../../shared/cloze.js";
import { typeLabel } from "./types.js";

export const CORRECT = "correct";
export const WRONG = "wrong";
export const SKIPPED = "skipped";

/**
 * 객관식 채점. 고르지 않은 문제(null/undefined)는 오답이 아니라 스킵으로 남긴다 —
 * 몰라서 틀린 것과 아예 안 푼 것은 학습자에게 다른 정보다.
 * questions: [{type, answer}] · choices: (number|null)[]
 */
export function gradeChoices(questions, choices) {
  return (questions || []).map((q, i) => {
    const chosen = choices?.[i];
    const status = chosen === null || chosen === undefined ? SKIPPED : chosen === q.answer ? CORRECT : WRONG;
    return { index: i, type: q.type, chosen: status === SKIPPED ? null : chosen, answer: q.answer, status };
  });
}

/**
 * 빈칸 채점. 표현 전체가 맞아야 정답이지만 어디가 틀렸는지 보여 주려고 단어별 결과도 함께 낸다.
 * 한 글자도 쓰지 않았으면 스킵.
 * blanks: [{expression}] · typed: string[][] (빈칸별 단어 입력)
 */
export function gradeBlanks(blanks, typed) {
  return (blanks || []).map((b, i) => {
    const words = typed?.[i] ?? [];
    const wordFlags = checkWords(words, b.expression);
    const empty = words.every((w) => !String(w ?? "").trim());
    return {
      index: i,
      wordFlags,
      status: empty ? SKIPPED : wordFlags.every(Boolean) ? CORRECT : WRONG,
    };
  });
}

/**
 * 4지선다·정답 인덱스가 성립하는 문제만 남긴다. 구조화 출력 스키마가 배열 길이와 정수 범위를
 * 강제하지 못해(minItems>1·minimum 미지원), AI 응답을 받은 뒤 여기서 대신 검증한다.
 * 문제 생성(ai.js)과 미리 생성 스크립트(scripts/gen-reading-sets.js)가 함께 쓴다.
 */
export function validQuestions(questions) {
  return (questions || []).filter(
    (q) => Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3
  );
}

/** 객관식 + 빈칸을 합친 이해도 집계. */
export function comprehensionSummary(results) {
  const count = (status) => results.filter((r) => r.status === status).length;
  const total = results.length;
  const correct = count(CORRECT);
  const answered = total - count(SKIPPED);
  return {
    total,
    correct,
    wrong: count(WRONG),
    skipped: count(SKIPPED),
    // 정답률은 푼 문제 기준이다. 스킵을 오답으로 세면 "모르는 건 넘기라"는 안내와 어긋난다.
    accuracy: answered ? Math.round((correct / answered) * 100) : null,
  };
}

/**
 * 틀린 문제가 많은 유형부터. 종합 평가에서 "무엇을 더 연습해야 하는지"를 로컬로 뽑기 위한 것 —
 * 이걸 AI에게 시키지 않아 토큰이 들지 않는다. 스킵은 약점 근거로 세지 않는다(풀지 않았을 뿐이다).
 */
export function weakTypes(choiceResults) {
  const missed = new Map();
  for (const r of choiceResults) {
    if (r.status !== WRONG) continue;
    missed.set(r.type, (missed.get(r.type) || 0) + 1);
  }
  return [...missed.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, label: typeLabel(type), count }));
}
