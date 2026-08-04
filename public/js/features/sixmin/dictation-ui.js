// 리스닝 받아쓰기 화면(구간 하나). AI를 쓰지 않는다 — 빈칸 선택도 채점도 전부 로컬이다.
//
// 빈칸 만들기·채점은 shared/dictation.js, 입력칸·힌트는 shared/cloze-view.js를 그대로 쓴다
// (🎧 3분 학습·글쓰기·복습과 같은 조작감: 글자당 칸, 스페이스바로 다음 단어, 첫 글자 힌트).
import { blankInputsHTML, blankResultHTML, readWords, showFirstLetters, weaveHTML, wireCells } from "../../shared/cloze-view.js";
import { buildDictation, gradeDictation } from "../../shared/dictation.js";
import { $, esc } from "../../shared/dom.js";

const HOST = "#sixmin-dictation";

/** 구간의 턴들을 받아쓰기 줄로. 화자 이름은 빈칸으로 만들지 않고 그대로 보여 준다(누가 말하는지 단서). */
function linesOf(segment, difficulty) {
  return buildDictation(
    segment.turns.map((t) => ({ type: "para", text: t.text })),
    difficulty
  );
}

/** 줄마다 화자 이름을 얹어 그린다. weaveHTML은 호출마다 빈칸 번호가 0부터라 직접 이어 센다. */
function transcriptHTML(segment, lines, blankHTML) {
  let offset = 0;
  return lines
    .map((line, i) => {
      const body = weaveHTML([line], (j, blank) => blankHTML(offset + j, blank));
      offset += line.blanks.length;
      return `<div class="tr-turn"><div class="tr-speaker">${esc(segment.turns[i].speaker)}</div>${body}</div>`;
    })
    .join("");
}

function showResult(segment, lines, difficulty, typedByBlank, context) {
  const flags = gradeDictation(lines, typedByBlank);
  const correct = flags.filter(Boolean).length;

  $(HOST).innerHTML = `
    <div class="card">
      ${transcriptHTML(segment, lines, (i, blank) => blankResultHTML(blank.answer, [flags[i]], [typedByBlank[i]?.[0] ?? ""]))}
      <p class="cloze-summary">빈칸 ${flags.length}개 중 <b>${correct}개</b> 맞았어요.</p>
    </div>
    <div class="row-end">
      <button class="btn-secondary" id="sixmin-dict-retry" type="button">🔁 다시 풀기</button>
      ${context.hasNext ? `<button class="btn-primary" id="sixmin-dict-next" type="button">다음 구간 →</button>` : ""}
    </div>`;

  context.onGraded({ total: flags.length, correct });
  $("#sixmin-dict-retry").addEventListener("click", () => mountDictation(segment, difficulty, context));
  $("#sixmin-dict-next")?.addEventListener("click", context.onNext);
}

/**
 * 구간 하나의 받아쓰기 폼을 그린다.
 * context: { hasNext, onNext, onGraded({total, correct}) }
 */
export function mountDictation(segment, difficulty, context) {
  const lines = linesOf(segment, difficulty);
  const flat = lines.flatMap((l) => l.blanks);

  $(HOST).innerHTML = `
    <form id="sixmin-dict-form" class="card">
      ${transcriptHTML(segment, lines, (i, blank) => blankInputsHTML(blank.answer, i))}
      <div class="row-end">
        <button class="btn-text" id="sixmin-dict-hint" type="button">🔤 첫 글자 힌트</button>
        <button class="btn-primary" type="submit">채점하기</button>
      </div>
    </form>`;

  const host = $(HOST);
  wireCells(host);

  $("#sixmin-dict-hint").addEventListener("click", () => {
    flat.forEach((blank, i) => showFirstLetters(host, blank.answer, i));
  });

  $("#sixmin-dict-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    showResult(segment, lines, difficulty, flat.map((_, i) => readWords(host, i)), context);
  });
}
