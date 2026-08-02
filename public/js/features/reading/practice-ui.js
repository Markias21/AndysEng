// 리딩 연습 화면. 지문 + 객관식 + 표현 빈칸 + 재진술 + 요약을 한 화면에 내고 제출 한 번으로 끝낸다.
// 실제 토플 리딩 섹션처럼 지문을 보면서 풀고, 답하지 않은 문제는 스킵으로 처리한다.
//
// 문제 세트 생성(AI)은 지문을 그리는 즉시 백그라운드로 돌린다 — 유저가 읽는 동안 준비되므로
// 기다리는 느낌이 없다. 세트는 영구 캐시되므로 두 번째부터는 호출조차 없다.
import { buildCloze } from "../../shared/cloze.js";
import { blankInputsHTML, readWords, showFirstLetters, weaveHTML, wireCells } from "../../shared/cloze-view.js";
import { $, esc } from "../../shared/dom.js";
import { getProfile } from "../../shared/store.js";
import { questionSet } from "./ai.js";
import { gradeBlanks, gradeChoices } from "./score.js";
import { typeLabel } from "./types.js";
import { showResult } from "./result-ui.js";

const ROOT = "#reading-content";

// 읽기 시간 표시용 타이머. 화면을 떠날 때 반드시 멈춘다.
let ticking = null;

function stopTimer() {
  clearInterval(ticking);
  ticking = null;
}

function startTimer(startedAt) {
  stopTimer();
  const paint = () => {
    const el = $("#reading-timer");
    if (!el) return stopTimer();
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    el.textContent = `⏱ ${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  };
  paint();
  ticking = setInterval(paint, 1000);
}

function passageHTML(article) {
  const body = article.paragraphs
    .map((p) => (p.type === "heading" ? `<h4 class="passage-heading">${esc(p.text)}</h4>` : `<p>${esc(p.text)}</p>`))
    .join("");
  const glossary = article.glossary?.length
    ? `<details class="rubric-guide"><summary>📗 지문 어휘 풀이 (VOA 제공)</summary>
        <ul>${article.glossary.map((g) => `<li><b>${esc(g.word)}</b> <i>${esc(g.pos)}.</i> ${esc(g.meaning)}</li>`).join("")}</ul>
      </details>`
    : "";
  return `<article class="card reading-passage">
      <h3>${esc(article.title)}</h3>
      <p class="small muted">VOA Learning English · ${article.words}단어 · 약 ${Math.max(2, Math.round(article.words / 150))}분</p>
      ${body}
      ${glossary}
    </article>`;
}

function choiceHTML(q, i) {
  const options = q.options
    .map(
      (o, j) =>
        `<label class="mc-option"><input type="radio" name="rq${i}" value="${j}" /><span>${esc(o)}</span></label>`
    )
    .join("");
  return `<div class="card mc-card">
      <div class="mc-head"><span class="chip">${i + 1}</span><span class="small muted">${esc(typeLabel(q.type))}</span></div>
      <p class="mc-stem">${esc(q.stem)}</p>
      <div class="mc-options">${options}</div>
    </div>`;
}

/**
 * 빈칸 문제 하나 = 그 표현이 등장한 지문 문장 + 한국어 해석(단서). 표현 뜻은 일부러 감춘다 —
 * 뜻이 보이면 인출이 아니라 번역이 된다. 지문에서 표현을 못 찾은 항목은 문제가 성립하지 않아 버린다.
 */
function clozeItems(blanks) {
  return blanks
    .map((blank) => ({ blank, line: buildCloze([{ sentence: blank.sentence, translation: blank.sentence_ko }], [blank])[0] }))
    .filter((item) => item.line.blanks.length === 1);
}

function clozeHTML(items) {
  if (!items.length) return "";
  return `<h3 class="section-title">🔤 표현 빈칸</h3>
    <p class="small muted">지문에 나온 표현이에요. 한국어 해석을 단서로 빈칸을 채워 보세요.</p>
    ${items.map((item, i) => `<div class="card cloze-card">${weaveHTML([item.line], () => blankInputsHTML(item.line.blanks[0].answer, i))}</div>`).join("")}`;
}

function produceHTML(set) {
  return `<h3 class="section-title">✍️ 문장 재진술</h3>
    <div class="card">
      <p class="small muted">아래 문장을 뜻은 그대로, 표현과 구조는 바꿔서 다시 써 보세요.</p>
      <p class="question-text">${esc(set.restate_sentence)}</p>
      <textarea id="reading-restate" rows="3" placeholder="Same meaning, different words..."></textarea>
    </div>

    <h3 class="section-title">📝 요약</h3>
    <div class="card">
      <p class="small muted">지문 전체를 영어 <b>3문장 이내</b>로 요약하세요. 지문을 그대로 베끼지 말고 자기 말로 쓰는 것이 핵심이에요.</p>
      <textarea id="reading-summary" rows="4" placeholder="In this passage, ..."></textarea>
    </div>`;
}

function formHTML(set, items) {
  return `<form id="reading-form">
      <h3 class="section-title">❓ 이해 문제</h3>
      ${set.questions.map(choiceHTML).join("")}
      ${clozeHTML(items)}
      ${produceHTML(set)}
      <div class="row-end">
        ${items.length ? `<button class="btn-text" id="reading-hint" type="button">🔤 첫 글자 힌트</button>` : ""}
        <button class="btn-primary" type="submit">제출하고 채점받기</button>
      </div>
      <p class="small muted">답하지 않은 문제는 <b>스킵</b>으로 처리돼요. 재진술과 요약을 모두 비우면 AI 채점 없이 결과만 보여 줘요(비용 0원).</p>
    </form>`;
}

function collect(root, set, items) {
  const choices = set.questions.map((_, i) => {
    const picked = root.querySelector(`input[name="rq${i}"]:checked`);
    return picked ? Number(picked.value) : null;
  });
  const typed = items.map((_, i) => readWords(root, i));
  return {
    choices,
    typed,
    choiceResults: gradeChoices(set.questions, choices),
    blankResults: gradeBlanks(items.map((it) => it.blank), typed),
    restatement: $("#reading-restate").value.trim(),
    summary: $("#reading-summary").value.trim(),
  };
}

function mountForm(article, set, context, startedAt) {
  const items = clozeItems(set.blanks);
  const host = $("#reading-questions");
  host.innerHTML = formHTML(set, items);
  wireCells(host);

  if (items.length) {
    $("#reading-hint").addEventListener("click", () => {
      items.forEach((item, i) => showFirstLetters(host, item.line.blanks[0].answer, i));
    });
  }

  $("#reading-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    stopTimer();
    const submitted = collect(host, set, items);
    showResult({ article, set, items, ...submitted, elapsedMs: Date.now() - startedAt, ...context });
  });
}

/** 지문을 열어 읽기+문제 화면을 그린다. context: { onBackToList, onBackToCategories } */
export async function startPractice(article, context) {
  stopTimer();
  const startedAt = Date.now();
  $(ROOT).innerHTML = `
    <div class="room-toolbar">
      <button class="btn-text" id="reading-back" type="button">← 목록</button>
      <span class="toolbar-actions">
        <span class="chip" id="reading-timer">⏱ 00:00</span>
        <button class="btn-secondary btn-chip dict-open-btn" type="button">📖 사전</button>
        <button class="btn-secondary btn-chip translate-open-btn" type="button" data-feature="reading">🌐 번역기</button>
      </span>
    </div>
    ${passageHTML(article)}
    <div id="reading-questions"><p class="muted">문제를 준비하고 있어요… 먼저 지문을 읽으세요.</p></div>`;

  $("#reading-back").addEventListener("click", () => {
    stopTimer();
    context.onBackToList();
  });
  startTimer(startedAt);

  try {
    const set = await questionSet(article, getProfile().level);
    // 준비되는 동안 유저가 화면을 떠났을 수 있다.
    if ($("#reading-questions")) mountForm(article, set, context, startedAt);
  } catch (e) {
    const host = $("#reading-questions");
    if (!host) return;
    host.innerHTML = `<p class="error-text">${esc(e.message)}</p>
      <button class="btn-secondary" id="reading-retry-gen" type="button">🔄 다시 시도</button>`;
    $("#reading-retry-gen").addEventListener("click", () => startPractice(article, context));
  }
}
