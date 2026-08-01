// 빈칸 입력칸의 공통 렌더링·조작. 글쓰기(모범 답안 복원)와 복습(예문 빈칸)이 같은 모양을 쓴다.
// 판정은 cloze.js(순수 도메인)가 하고 여기서는 DOM만 다룬다.
//
// 한 글자 = 칸 하나다. 칸이 물리적으로 나뉘어 있어야 몇 단어에 몇 글자인지 세지 않고도 보인다.
// 칸은 좁게(1em대) 잡고 단어 사이에서만 줄바꿈해, 좁은 화면에서도 가로 스크롤이 생기지 않게 한다.
import { wordsOf } from "./cloze.js";
import { esc } from "./dom.js";

const CELL = ".cloze-cell";

/** parts/blanks를 번갈아 이어 붙인다. blank(i)는 parts[i+1] 앞에 온다. */
export function weaveHTML(lines, blankHTML) {
  let index = 0;
  return lines
    .map((line) => {
      const body = line.parts
        .map((part, p) => (p === 0 ? esc(part) : blankHTML(index++, line.blanks[p - 1]) + esc(part)))
        .join("");
      const ko = line.translation ? `<span class="answer-ko">${esc(line.translation)}</span>` : "";
      return `<div class="cloze-line">${body}${ko}</div>`;
    })
    .join("");
}

/** 표현 하나를 단어 → 글자 순으로 쪼갠 입력칸들. blankIndex로 그룹을 구분한다. */
export function blankInputsHTML(answer, blankIndex = 0) {
  const words = wordsOf(answer)
    .map((word, wi) => {
      const cells = [...word]
        .map(
          (_, ci) =>
            `<input class="cloze-cell" type="text" maxlength="1" autocomplete="off" autocapitalize="off"
              autocorrect="off" spellcheck="false" data-b="${blankIndex}" data-w="${wi}" data-c="${ci}" />`
        )
        .join("");
      return `<span class="cloze-word">${cells}</span>`;
    })
    .join("");
  return `<span class="cloze-blank">${words}</span>`;
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

/** blankIndex에 입력된 내용을 단어별 문자열로 모은다. 비어 있는 칸은 빈 문자열. */
export function readWords(root, blankIndex = 0) {
  const words = [];
  root.querySelectorAll(`${CELL}[data-b="${blankIndex}"]`).forEach((el) => {
    const wi = Number(el.dataset.w);
    words[wi] = (words[wi] ?? "") + el.value;
  });
  return [...words].map((w) => w ?? "");
}

/** 길이는 칸 개수가 이미 알려 주므로, 힌트는 각 단어의 첫 글자만 흘려 준다. */
export function showFirstLetters(root, answer, blankIndex = 0) {
  const words = wordsOf(answer);
  root.querySelectorAll(`${CELL}[data-b="${blankIndex}"][data-c="0"]`).forEach((el) => {
    const word = words[Number(el.dataset.w)];
    if (word) el.placeholder = word[0];
  });
}

function focusCell(cells, i) {
  const el = cells[i];
  if (!el) return;
  el.focus();
  el.select();
}

/** 지금 칸 다음에 오는 다른 단어의 첫 칸. 없으면 -1. */
function nextWordStart(cells, i) {
  const { b, w } = cells[i].dataset;
  return cells.findIndex((el, j) => j > i && (el.dataset.b !== b || el.dataset.w !== w));
}

/**
 * 칸 사이 이동을 붙인다: 한 글자 입력하면 자동으로 다음 칸, 스페이스는 다음 단어의 첫 칸,
 * 빈 칸에서 백스페이스는 앞 칸으로(그 칸을 지우면서), 좌우 화살표로도 이동.
 */
export function wireCells(root) {
  const cells = [...root.querySelectorAll(CELL)];
  cells.forEach((cell, i) => {
    cell.addEventListener("focus", () => cell.select());
    cell.addEventListener("input", () => {
      // 모바일 자동완성이 여러 글자를 한 번에 넣는 경우가 있어 마지막 글자만 남긴다.
      if (cell.value.length > 1) cell.value = cell.value.slice(-1);
      if (cell.value) focusCell(cells, i + 1);
    });
    cell.addEventListener("keydown", (ev) => {
      if (ev.key === " ") {
        ev.preventDefault();
        const next = nextWordStart(cells, i);
        if (next >= 0) focusCell(cells, next);
      } else if (ev.key === "Backspace" && !cell.value && cells[i - 1]) {
        ev.preventDefault();
        cells[i - 1].value = "";
        focusCell(cells, i - 1);
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        focusCell(cells, i - 1);
      } else if (ev.key === "ArrowRight") {
        ev.preventDefault();
        focusCell(cells, i + 1);
      }
    });
  });
  return cells;
}
