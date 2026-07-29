// 원어민 모범 답안 인출(빈칸 복원) 화면. 판정은 cloze.js(순수 도메인)가 하고 여기서는 렌더링과 덱 추가만 한다.
import { buildCloze, checkBlank } from "./cloze.js";
import { addToDeck } from "../../shared/store.js";
import { $, esc } from "../../shared/dom.js";

/** 여러 단어짜리 표현은 단어마다 첫 글자만 흘려 준다. 인출이 아예 불가능하면 학습이 일어나지 않기 때문. */
function hintFor(answer) {
  return answer
    .split(/\s+/)
    .map((w) => `${w[0]}…`)
    .join(" ");
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

function toCard(expr) {
  return {
    expression: expr.expression,
    meaning: expr.meaning,
    example: expr.example,
    level: expr.level,
    nonLiteral: expr.non_literal,
    source: "writing",
  };
}

function showResult(root, lines, answers, okFlags, expressions) {
  const flat = lines.flatMap((l) => l.blanks);
  const correct = okFlags.filter(Boolean).length;
  // 인출에 실패한 표현이 가장 학습 가치가 크다 — 고르게 하지 않고 바로 복습 덱에 넣는다.
  const missed = flat.filter((_, i) => !okFlags[i]).map((b) => expressions[b.exprIndex]).filter(Boolean);
  addToDeck(missed.map(toCard));

  const body = weave(lines, (i, blank) =>
    okFlags[i]
      ? `<span class="cloze-ok">${esc(blank.answer)}</span>`
      : `<span class="cloze-miss">${answers[i].trim() ? `<s>${esc(answers[i].trim())}</s> → ` : ""}<b>${esc(blank.answer)}</b></span>`
  );

  root.innerHTML = `
    <h4>🔤 원어민 문장 되찾기</h4>
    <div class="card">
      ${body}
      <p class="cloze-summary">${flat.length}개 중 <b>${correct}개</b> 맞았어요.${
        missed.length ? ` 못 맞힌 표현 ${missed.length}개는 복습에 담았어요.` : " 전부 맞혔어요! 🎉"
      }</p>
    </div>`;

  return new Set(missed.map((e) => e.expression));
}

/**
 * 빈칸 복원 화면을 root에 그린다. 확인/건너뛰기를 누르면 onReveal(담은 표현 Set)을 호출한다.
 * 빈칸이 하나도 없으면(모범 답안에서 표현을 못 찾은 경우) 그리지 않고 즉시 공개한다.
 */
export function mountCloze(root, result, onReveal) {
  const lines = buildCloze(result.native_answer, result.native_expressions);
  const flat = lines.flatMap((l) => l.blanks);
  if (flat.length === 0) return onReveal(new Set());

  root.innerHTML = `
    <h4>🔤 원어민 문장 되찾기 <span class="reason">(채우고 나면 아래에 전체 첨삭이 열려요)</span></h4>
    <div class="card">
      <p class="reason">원어민이라면 이렇게 썼어요. 한국어 해석을 힌트 삼아 빈칸을 채워 보세요. 읽기만 할 때보다 훨씬 오래 남아요.</p>
      <form id="cloze-form">
        ${weave(lines, (i) => `<input class="cloze-input" type="text" autocomplete="off" spellcheck="false" data-i="${i}" />`)}
        <div class="row-end">
          <button class="btn-text" id="cloze-hint" type="button">🔤 첫 글자 힌트</button>
          <button class="btn-text" id="cloze-skip" type="button">⏭ 건너뛰고 첨삭 보기</button>
          <button class="btn-primary" type="submit">확인하기</button>
        </div>
      </form>
    </div>`;

  const inputs = [...root.querySelectorAll(".cloze-input")];
  inputs[0]?.focus();

  $("#cloze-hint").addEventListener("click", () => {
    inputs.forEach((el, i) => (el.placeholder = hintFor(flat[i].answer)));
  });

  $("#cloze-skip").addEventListener("click", () => onReveal(new Set()));

  $("#cloze-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const answers = inputs.map((el) => el.value);
    const okFlags = flat.map((blank, i) => checkBlank(answers[i], blank.answer));
    onReveal(showResult(root, lines, answers, okFlags, result.native_expressions));
  });
}
