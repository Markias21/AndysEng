// 복습 문제 화면(말해보카식): 예문의 빈칸을 채워 표현을 인출한다.
// 문제를 만드는 건 quiz.js(순수 도메인), 판정은 shared/cloze.js, 입력칸은 shared/cloze-view.js가 맡는다.
// 다음 복습 간격은 이 빈칸의 정답 여부가 정한다(자가평가 없음).
import { buildQuiz } from "./quiz.js";
import { checkWords } from "../../shared/cloze.js";
import { blankInputsHTML, blankResultHTML, readWords, showFirstLetters, wireCells } from "../../shared/cloze-view.js";
import { nounFor, withParticle } from "./labels.js";
import { $, esc, nonLiteralBadge } from "../../shared/dom.js";

const CONTENT = "#srs-content";

function meaningLine(item) {
  return `<div class="word-meaning">${esc(item.meaning)}${nonLiteralBadge(item.nonLiteral)}</div>${
    item.pos ? `<p class="dict-pos">${esc(item.pos)}</p>` : ""
  }`;
}

/** 예문 모드는 예문이 단서라 뜻을 감춰 두고, 뜻 모드는 뜻이 곧 문제라 그대로 보여 준다. */
function questionBody(quiz, item, noun) {
  if (quiz.mode === "term") {
    return `${meaningLine(item)}
      <p class="reason">이 뜻에 해당하는 ${withParticle(noun, "을", "를")} 써 보세요.</p>
      <div class="cloze-line quiz-line">${blankInputsHTML(quiz.answer)}</div>`;
  }
  return `<div class="cloze-line quiz-line">${esc(quiz.parts[0])}${blankInputsHTML(quiz.answer)}${esc(quiz.parts[1])}</div>
    ${quiz.translation ? `<p class="quiz-ko">${esc(quiz.translation)}</p>` : ""}
    <div class="row-end">
      <button class="btn-text" id="srs-show-meaning" type="button">📖 ${noun} 뜻 알아보기</button>
    </div>
    <div class="hidden" id="srs-meaning">${meaningLine(item)}</div>`;
}

function revealBody(quiz, item, typed, flags) {
  const filled = blankResultHTML(quiz.answer, flags, typed);
  const sentence =
    quiz.mode === "term"
      ? `<div class="cloze-line quiz-line">${filled}</div>${item.example ? `<p class="example">예시: ${esc(item.example)}</p>` : ""}`
      : `<div class="cloze-line quiz-line">${esc(quiz.parts[0])}${filled}${esc(quiz.parts[1])}</div>${
          quiz.translation ? `<p class="quiz-ko">${esc(quiz.translation)}</p>` : ""
        }`;
  return `${meaningLine(item)}${sentence}`;
}

/**
 * 문제 → 채점 → 공개까지를 한 카드 안에서 진행한다.
 * item: items.js의 wrap 결과, meta: {remaining, inRetry}
 * handlers: { onNext(correct), onProduce(correct), onRemove() }
 */
export function renderQuiz(item, meta, handlers) {
  const quiz = buildQuiz(item);
  const noun = nounFor(item.kind);

  $(CONTENT).innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">${meta.inRetry ? "🔁 재도전" : `빈칸 채우기`} · 남은 항목 ${meta.remaining}</span>
      <form id="srs-quiz-form">
        ${questionBody(quiz, item, noun)}
        <p class="reason cloze-guide">칸 하나가 글자 하나예요. 스페이스바를 누르면 다음 단어로 넘어가요.</p>
        <div class="row-end">
          <button class="btn-text" id="srs-hint" type="button">🔤 첫 글자 힌트</button>
          <button class="btn-primary" type="submit">확인하기</button>
        </div>
      </form>
      ${meta.inRetry ? "" : `<div class="row-end"><button class="btn-secondary btn-chip" id="srs-remove" type="button">🗑 이 ${noun} 빼기</button></div>`}
    </div>`;

  const root = $(CONTENT);
  const cells = wireCells(root);
  cells[0]?.focus();
  $("#srs-hint").addEventListener("click", () => showFirstLetters(root, quiz.answer));
  const meaningBtn = $("#srs-show-meaning");
  if (meaningBtn)
    meaningBtn.addEventListener("click", () => {
      $("#srs-meaning").classList.remove("hidden");
      meaningBtn.classList.add("hidden");
    });
  const removeBtn = $("#srs-remove");
  if (removeBtn) removeBtn.addEventListener("click", handlers.onRemove);

  $("#srs-quiz-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const typed = readWords(root);
    const flags = checkWords(typed, quiz.answer);
    renderReveal(quiz, item, typed, flags, meta, handlers);
  });
}

function renderReveal(quiz, item, typed, flags, meta, handlers) {
  const correct = flags.length > 0 && flags.every(Boolean);
  const actions = meta.inRetry
    ? `<div class="row-end"><button class="btn-primary" id="srs-next" type="button">다음 →</button></div>`
    : `<div class="row-rate">
         <button class="${correct ? "btn-primary" : "btn-secondary"}" id="srs-next" type="button">⏭ 다음</button>
         <button class="${correct ? "btn-secondary" : "btn-primary"}" id="srs-produce" type="button">✍️ 내 이야기로 예문 만들기</button>
       </div>`;

  $(CONTENT).innerHTML = `
    <div class="card">
      <span class="chip ${correct ? "chip-green" : "chip-red"}">${correct ? "✅ 정답" : "❌ 아쉬워요"}</span>
      <h3 class="expr-word">${esc(item.term)}</h3>
      ${revealBody(quiz, item, typed, flags)}
      ${correct || meta.inRetry ? "" : `<p class="reason">방금 놓친 ${withParticle(nounFor(item.kind), "은", "는")} 예문까지 만들어 보면 훨씬 오래 남아요.</p>`}
      ${actions}
    </div>`;

  $("#srs-next").addEventListener("click", () => handlers.onNext(correct));
  const produceBtn = $("#srs-produce");
  if (produceBtn) produceBtn.addEventListener("click", () => handlers.onProduce(correct));
}
