// 빈칸 문제 생성/채점 도메인 로직. 순수 함수만 — AI를 쓰지 않는다.

/** 대소문자/공백/양끝 구두점 차이를 무시하고 비교하기 위한 정규화. */
export function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s.,!?'"“”‘’:;]+|[\s.,!?'"“”‘’:;]+$/g, "");
}

/**
 * 카드로 빈칸 문제를 만든다.
 * 예문에 표현이 그대로 들어 있으면 예문의 표현을 빈칸으로 뚫고(cloze),
 * 없으면 뜻을 보고 표현을 떠올리는 문제(recall)로 폴백한다.
 */
export function buildQuiz(card) {
  const example = card.example || "";
  const idx = example.toLowerCase().indexOf(card.expression.toLowerCase());
  if (idx >= 0) {
    const answer = example.slice(idx, idx + card.expression.length);
    return {
      type: "cloze",
      prompt: `${example.slice(0, idx)}____${example.slice(idx + card.expression.length)}`,
      answer,
      hint: card.meaning,
    };
  }
  return {
    type: "recall",
    prompt: card.meaning,
    answer: card.expression,
    hint: example,
  };
}

/** 로컬 채점. 정규화 후 일치하면 정답. */
export function grade(userAnswer, answer) {
  return normalize(userAnswer) === normalize(answer);
}
