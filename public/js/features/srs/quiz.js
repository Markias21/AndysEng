// 복습 카드 하나를 빈칸 문제로 바꾸는 도메인 로직. 순수 함수만 — UI/저장소를 import하지 않는다.
//
// 기본은 카드의 예문에서 표현만 빈칸으로 뚫는 방식이다(예문 + 해석이 단서, 표현이 정답).
// 예문이 없거나 예문 안에서 표현을 못 찾으면 뜻을 단서로 표현 자체를 쓰게 한다.
import { buildCloze } from "../../shared/cloze.js";
import { variantsOf } from "../../shared/inflect.js";

/**
 * item: {term, meaning, example, exampleKo} (items.js의 wrap 결과)
 * 반환: { mode: "example", parts: [앞, 뒤], answer, translation } — 예문 빈칸
 *      { mode: "term", answer } — 뜻만 보고 표현 쓰기
 * answer는 예문에 실제로 쓰인 표기(활용형·대소문자)를 그대로 따른다.
 */
export function buildQuiz(item) {
  const example = String(item?.example ?? "").trim();
  const term = String(item?.term ?? "").trim();
  if (example && term) {
    for (const variant of variantsOf(term)) {
      const [line] = buildCloze([example], [{ expression: variant }]);
      if (line.blanks.length > 0) {
        return {
          mode: "example",
          parts: line.parts,
          answer: line.blanks[0].answer,
          translation: String(item.exampleKo ?? ""),
        };
      }
    }
  }
  return { mode: "term", answer: term };
}
