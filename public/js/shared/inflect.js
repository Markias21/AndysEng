// 영어 굴절형. 순수 함수만.
// 복습(예문에서 표현 찾기)과 글쓰기 다시 쓰기(표현을 실제로 썼는지 판정)가 같은 규칙을 써야 해서 shared에 둔다.
import { wordsOf } from "./cloze.js";

const VOWEL = /[aeiou]/i;

/** 흔한 굴절형. 글에는 원형이 아니라 활용형으로 등장한다("pay off" → "pays off"). */
export function inflections(word) {
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
 * 글에서 찾아볼 표현의 후보들. 원형을 먼저 보고, 없으면 굴절형까지 넓힌다.
 * 굴절되는 자리는 첫 단어(구동사의 동사 — pay off → pays off) 아니면 마지막 단어다.
 * 0번째는 항상 원형이다(호출자가 .slice(1)로 굴절형만 쓰기도 한다).
 */
export function variantsOf(term) {
  const words = wordsOf(term);
  if (words.length === 0) return [];
  const at = (i) => inflections(words[i]).slice(1).map((form) => words.map((w, j) => (j === i ? form : w)).join(" "));
  const last = words.length - 1;
  return [words.join(" "), ...at(0), ...(last > 0 ? at(last) : [])];
}
