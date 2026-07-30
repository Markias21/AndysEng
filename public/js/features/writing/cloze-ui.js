// 원어민 모범 답안 인출(빈칸 복원) 화면. 판정은 cloze.js(순수 도메인)가 하고 여기서는 렌더링만 한다.
import { buildCloze, checkWords, wordsOf } from "./cloze.js";
import { $, esc } from "../../shared/dom.js";

// 자리점 하나가 글자 하나. 표현이 몇 단어이고 각 단어가 몇 글자인지 보여 주지 않으면 인출 난이도가 과하게 올라간다.
const DOT = "·";

function dots(word) {
  return DOT.repeat(word.length);
}

/** 힌트: 첫 글자만 드러내고 나머지는 자리점으로 남긴다. */
function hintFor(word) {
  return word[0] + DOT.repeat(word.length - 1);
}

function inputHTML(blankIndex, wordIndex, word) {
  return `<input class="cloze-input" type="text" autocomplete="off" spellcheck="false"
    data-b="${blankIndex}" data-w="${wordIndex}" style="width:${word.length + 1.5}ch" placeholder="${dots(word)}" />`;
}

/** parts/blanks를 번갈아 이어 붙인다. blank(i)는 parts[i+1] 앞에 온다. */
function weave(lines, blankHTML) {
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

function blankInputsHTML(blankIndex, blank) {
  const words = wordsOf(blank.answer);
  return `<span class="cloze-blank">${words.map((w, wi) => inputHTML(blankIndex, wi, w)).join(" ")}</span>`;
}

function blankResultHTML(blank, flags, typed) {
  return wordsOf(blank.answer)
    .map((word, wi) =>
      flags[wi]
        ? `<span class="cloze-ok">${esc(word)}</span>`
        : `<span class="cloze-miss">${typed[wi]?.trim() ? `<s>${esc(typed[wi].trim())}</s> ` : ""}<b>${esc(word)}</b></span>`
    )
    .join(" ");
}

function showResult(root, lines, typedByBlank, wordFlags, okFlags, expressions) {
  const flat = lines.flatMap((l) => l.blanks);
  const correct = okFlags.filter(Boolean).length;
  const missed = flat.filter((_, i) => !okFlags[i]).map((b) => expressions[b.exprIndex]).filter(Boolean);

  const body = weave(lines, (i, blank) => blankResultHTML(blank, wordFlags[i], typedByBlank[i]));

  root.innerHTML = `
    <h4>🔤 원어민 문장 되찾기</h4>
    <div class="card">
      ${body}
      <p class="cloze-summary">표현 ${flat.length}개 중 <b>${correct}개</b> 맞았어요.${
        missed.length ? " 못 맞힌 표현은 아래 표현 목록에 표시했어요 — 담을 것만 골라 복습에 추가하세요." : " 전부 맞혔어요! 🎉"
      }</p>
    </div>`;

  return new Set(missed.map((e) => e.expression));
}

/**
 * 빈칸 복원 화면을 root에 그린다. 확인/건너뛰기를 누르면 onReveal(못 맞힌 표현 문자열 Set)을 호출한다.
 * 빈칸이 하나도 없으면(모범 답안에서 표현을 못 찾은 경우) 그리지 않고 즉시 공개한다.
 */
export function mountCloze(root, result, onReveal) {
  const lines = buildCloze(result.native_answer, result.native_expressions);
  const flat = lines.flatMap((l) => l.blanks);
  if (flat.length === 0) return onReveal(new Set());

  root.innerHTML = `
    <h4>🔤 원어민 문장 되찾기 <span class="reason">(채우고 나면 아래에 전체 첨삭이 열려요)</span></h4>
    <div class="card">
      <p class="reason">원어민이라면 이렇게 썼어요. 한국어 해석을 힌트 삼아 빈칸을 채워 보세요. 빈칸은 단어 하나씩 나뉘어 있고, 자리점(${DOT}) 하나가 글자 하나예요.</p>
      <form id="cloze-form">
        ${weave(lines, blankInputsHTML)}
        <div class="row-end">
          <button class="btn-text" id="cloze-hint" type="button">🔤 첫 글자 힌트</button>
          <button class="btn-text" id="cloze-skip" type="button">⏭ 건너뛰고 첨삭 보기</button>
          <button class="btn-primary" type="submit">확인하기</button>
        </div>
      </form>
    </div>`;

  const groups = flat.map((blank, i) => [...root.querySelectorAll(`.cloze-input[data-b="${i}"]`)]);
  groups[0][0]?.focus();

  $("#cloze-hint").addEventListener("click", () => {
    groups.forEach((inputs, i) => {
      const words = wordsOf(flat[i].answer);
      inputs.forEach((el, wi) => (el.placeholder = hintFor(words[wi])));
    });
  });

  $("#cloze-skip").addEventListener("click", () => onReveal(new Set()));

  $("#cloze-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const typedByBlank = groups.map((inputs) => inputs.map((el) => el.value));
    const wordFlags = flat.map((blank, i) => checkWords(typedByBlank[i], blank.answer));
    const okFlags = wordFlags.map((flags) => flags.every(Boolean));
    onReveal(showResult(root, lines, typedByBlank, wordFlags, okFlags, result.native_expressions));
  });
}
