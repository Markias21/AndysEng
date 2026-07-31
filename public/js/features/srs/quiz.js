// 복습 카드 하나를 빈칸 문제로 바꾸는 도메인 로직. 순수 함수만 — UI/저장소를 import하지 않는다.
//
// 기본은 카드의 예문에서 표현만 빈칸으로 뚫는 방식이다(예문 + 해석이 단서, 표현이 정답).
// 예문이 없거나 예문 안에서 표현을 못 찾으면 뜻을 단서로 표현 자체를 쓰게 한다.
import { buildCloze, wordsOf } from "../../shared/cloze.js";

const VOWEL = /[aeiou]/i;

/** 흔한 굴절형. 예문에는 원형이 아니라 활용형으로 등장한다("pay off" → "pays off"). */
function inflections(word) {
  if (/y$/i.test(word)) {
    const stem = word.slice(0, -1);
    return [word, `${word}s`, `${stem}ies`, `${stem}ied`, `${word}ing`];
  }
  if (/(s|x|z|ch|sh)$/i.test(word)) return [word, `${word}es`, `${word}ed`, `${word}ing`];
  if (/e$/i.test(word)) return [word, `${word}s`, `${word}d`, `${word.slice(0, -1)}ing`];

  const forms = [word, `${word}s`, `${word}ed`, `${word}ing`];
  // 짧은 단어의 자음 반복(stop → stopped/stopping).
  const last = word.slice(-1);
  if (!VOWEL.test(last) && VOWEL.test(word.slice(-2, -1))) forms.push(`${word}${last}ed`, `${word}${last}ing`);
  return forms;
}

/**
 * 예문에서 찾아볼 표현의 후보들. 원형을 먼저 보고, 없으면 굴절형까지 넓힌다.
 * 굴절되는 자리는 첫 단어(구동사의 동사 — pay off → pays off) 아니면 마지막 단어다.
 */
export function variantsOf(term) {
  const words = wordsOf(term);
  if (words.length === 0) return [];
  const at = (i) => inflections(words[i]).slice(1).map((form) => words.map((w, j) => (j === i ? form : w)).join(" "));
  const last = words.length - 1;
  return [words.join(" "), ...at(0), ...(last > 0 ? at(last) : [])];
}

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
