// 빈칸 입력칸의 공통 렌더링. 글쓰기(모범 답안 복원)와 복습(예문 빈칸)이 같은 모양을 쓴다.
// 판정은 cloze.js(순수 도메인)가 하고 여기서는 HTML만 만든다.
import { wordsOf } from "./cloze.js";
import { esc } from "./dom.js";

// 잘린 밑줄 한 칸 = 글자 하나. 표현이 몇 단어이고 각 단어가 몇 글자인지 보여 주지 않으면 인출 난이도가 과하게 올라간다.
// SLOT(글자폭)·GAP(글자 사이 간격)은 styles.css의 .cloze-input 배경 주기(1.4ch = 1ch 밑줄 + 0.4ch 공백)와 짝이다.
const SLOT = 1;
const GAP = 0.4;

/** 글자 수만큼의 칸 폭. 마지막 글자 뒤 간격은 빼서 밑줄이 마지막 칸에서 딱 끝나게 한다. */
function slotsWidth(length) {
  return (length * (SLOT + GAP) - GAP).toFixed(2);
}

/** 표현 하나를 띄어쓰기 단위로 쪼갠 입력칸들. blankIndex로 그룹을 구분한다. */
export function blankInputsHTML(answer, blankIndex = 0) {
  const inputs = wordsOf(answer)
    .map(
      (word, wi) =>
        `<input class="cloze-input" type="text" autocomplete="off" spellcheck="false"
          data-b="${blankIndex}" data-w="${wi}" style="width:${slotsWidth(word.length)}ch" />`
    )
    .join(" ");
  return `<span class="cloze-blank">${inputs}</span>`;
}

/** 채점 후 표시: 맞은 단어는 그대로, 틀린 단어는 내가 쓴 것에 취소선 + 정답. */
export function blankResultHTML(answer, flags, typed) {
  return wordsOf(answer)
    .map((word, wi) =>
      flags[wi]
        ? `<span class="cloze-ok">${esc(word)}</span>`
        : `<span class="cloze-miss">${typed[wi]?.trim() ? `<s>${esc(typed[wi].trim())}</s> ` : ""}<b>${esc(word)}</b></span>`
    )
    .join(" ");
}

/** blankIndex에 속한 입력칸들. */
export function inputsOf(root, blankIndex = 0) {
  return [...root.querySelectorAll(`.cloze-input[data-b="${blankIndex}"]`)];
}

/** 길이는 밑줄 칸이 이미 알려 주므로, 힌트는 각 단어의 첫 글자만 흘려 준다. */
export function showFirstLetters(inputs, answer) {
  const words = wordsOf(answer);
  inputs.forEach((el, wi) => {
    if (words[wi]) el.placeholder = words[wi][0];
  });
}
