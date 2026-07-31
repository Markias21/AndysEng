// 원어민 모범 답안 인출(빈칸 복원) 화면. 판정은 shared/cloze.js(순수 도메인),
// 입력칸·채점 표시는 shared/cloze-view.js가 맡고 여기서는 화면 구성만 한다.
import { buildCloze, checkWords } from "../../shared/cloze.js";
import { blankInputsHTML, blankResultHTML, readWords, showFirstLetters, wireCells } from "../../shared/cloze-view.js";
import { $, esc } from "../../shared/dom.js";

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

function showResult(root, lines, typedByBlank, wordFlags, okFlags, expressions) {
  const flat = lines.flatMap((l) => l.blanks);
  const correct = okFlags.filter(Boolean).length;
  const missed = flat.filter((_, i) => !okFlags[i]).map((b) => expressions[b.exprIndex]).filter(Boolean);

  const body = weave(lines, (i, blank) => blankResultHTML(blank.answer, wordFlags[i], typedByBlank[i]));

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
      <p class="reason">원어민이라면 이렇게 썼어요. 한국어 해석을 힌트 삼아 빈칸을 채워 보세요. 칸 하나가 글자 하나고, 스페이스바를 누르면 다음 단어로 넘어가요.</p>
      <form id="cloze-form">
        ${weave(lines, (i, blank) => blankInputsHTML(blank.answer, i))}
        <div class="row-end">
          <button class="btn-text" id="cloze-hint" type="button">🔤 첫 글자 힌트</button>
          <button class="btn-text" id="cloze-skip" type="button">⏭ 건너뛰고 첨삭 보기</button>
          <button class="btn-primary" type="submit">확인하기</button>
        </div>
      </form>
    </div>`;

  const cells = wireCells(root);
  cells[0]?.focus();

  $("#cloze-hint").addEventListener("click", () => {
    flat.forEach((blank, i) => showFirstLetters(root, blank.answer, i));
  });

  $("#cloze-skip").addEventListener("click", () => onReveal(new Set()));

  $("#cloze-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const typedByBlank = flat.map((_, i) => readWords(root, i));
    const wordFlags = flat.map((blank, i) => checkWords(typedByBlank[i], blank.answer));
    const okFlags = wordFlags.map((flags) => flags.every(Boolean));
    onReveal(showResult(root, lines, typedByBlank, wordFlags, okFlags, result.native_expressions));
  });
}
