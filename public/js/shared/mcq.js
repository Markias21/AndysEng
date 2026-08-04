// 4지선다 채점 도메인 로직. 순수 함수만 — UI/저장소/AI를 import하지 않는다.
//
// 📖 리딩과 🎙 리스닝이 같은 방식으로 문제를 낸다: 문제를 만들 때 정답 키를 함께 받아 두므로
// 채점은 전부 여기서 끝나고, 한 번 만든 지문·에피소드는 몇 번을 다시 풀어도 AI 호출이 0회다.

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
 * 4지선다·정답 인덱스가 성립하는 문제만 남긴다. 구조화 출력 스키마가 배열 길이와 정수 범위를
 * 강제하지 못해(minItems>1·minimum 미지원), AI 응답을 받은 뒤 여기서 대신 검증한다.
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
 * labelOf: 유형 id → 화면에 보일 이름 (리딩·리스닝이 각자 자기 유형표를 넘긴다)
 */
export function weakTypes(choiceResults, labelOf) {
  const missed = new Map();
  for (const r of choiceResults) {
    if (r.status !== WRONG) continue;
    missed.set(r.type, (missed.get(r.type) || 0) + 1);
  }
  return [...missed.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, label: labelOf(type), count }));
}
