// 글쓰기 기본: 토플 수준 모범 답안에서 핵심 표현을 빈칸으로 뚫어 채우는 연습. AI 호출 없음(사전·번역기 제외) —
// 지문·해석·빈칸이 전부 정적 데이터라, 빈칸 판정도 shared/cloze.js를 그대로 재사용한다.
import { appendRecord, getProfile, getRecords, setProfile } from "../../shared/store.js";
import { pickFresh } from "../../shared/pick.js";
import { buildCloze, checkWords } from "../../shared/cloze.js";
import { blankInputsHTML, blankResultHTML, readWords, showFirstLetters, weaveHTML, wireCells } from "../../shared/cloze-view.js";
import { $, esc, expressionAddHTML, toast, wireExpressionAdds } from "../../shared/dom.js";
import { TEMPLATES, findTemplate } from "./templates.js";
import { DIFFICULTIES, DEFAULT_DIFFICULTY, blanksFor, findDifficulty } from "./difficulty.js";
import { ESSAYS, essaysOf, findEssay } from "./essays.js";

// 최근 이 개수만큼 푼 지문은 "🎲 아무거나"에서 피한다.
const RECENT_ESSAYS = 20;

function currentDifficulty() {
  return findDifficulty(getProfile().basicDifficulty)?.id || DEFAULT_DIFFICULTY;
}

function recentEssayIds() {
  return getRecords("writingBasic")
    .slice(-RECENT_ESSAYS)
    .map((r) => r.essayId);
}

/** 이 지문을 마지막으로 푼 기록(있으면). 카드에 최근 성적을 보여 주기 위함. */
function lastAttempt(essayId) {
  const records = getRecords("writingBasic").filter((r) => r.essayId === essayId);
  return records[records.length - 1] || null;
}

function essayCardHTML(essay, difficultyId) {
  const count = blanksFor(essay, difficultyId).length;
  const last = lastAttempt(essay.id);
  const lastLine = last ? `<span class="small muted">최근 ${last.correct}/${last.total}</span>` : "";
  return `<button class="btn-secondary essay-card" type="button" data-essay="${esc(essay.id)}">
      <b>${esc(essay.titleKo)}</b>
      <span class="reason">${esc(essay.prompt)}</span>
      <span class="small muted">빈칸 ${count}개</span>
      ${lastLine}
    </button>`;
}

function renderIntro() {
  const difficultyId = currentDifficulty();
  const root = $("#basic-content");
  const templateSections = TEMPLATES.map(
    (t) => `<h3 class="basic-template-title">${esc(t.label)}</h3>
      <p class="small muted">${esc(t.ko)}</p>
      <div class="essay-grid">${essaysOf(t.id).map((e) => essayCardHTML(e, difficultyId)).join("")}</div>`
  ).join("");

  root.innerHTML = `
    <h2 class="page-title">📝 글쓰기 기본</h2>
    <p class="muted">토플 만점 수준 모범 답안에서 핵심 표현을 빈칸으로 뚫었어요.<br/>사전이나 번역기를 쓰지 않는 한 AI를 전혀 쓰지 않아요.</p>
    <div class="diff-picker">${DIFFICULTIES.map(
      (d) => `<button class="btn-chip${d.id === difficultyId ? " active" : ""}" type="button" data-diff="${d.id}">${esc(d.label)}</button>`
    ).join("")}</div>
    <p class="small muted diff-desc">${esc(findDifficulty(difficultyId).ko)}</p>
    <div class="row-end"><button class="btn-secondary btn-chip" id="basic-random" type="button">🎲 아무거나</button></div>
    ${templateSections}`;

  root.querySelectorAll("[data-diff]").forEach((btn) =>
    btn.addEventListener("click", () => {
      setProfile({ basicDifficulty: btn.dataset.diff });
      renderIntro();
    })
  );
  root.querySelectorAll("[data-essay]").forEach((btn) =>
    btn.addEventListener("click", () => startPractice(btn.dataset.essay, difficultyId))
  );
  $("#basic-random").addEventListener("click", () => {
    const essay = pickFresh(ESSAYS, recentEssayIds(), (e) => e.id);
    if (!essay) return toast("지문을 불러오지 못했습니다.");
    startPractice(essay.id, difficultyId);
  });
}

/** 이 표현이 실제로 등장한 문장(과 해석)을 찾는다. 에세이마다 표현이 한 번만 등장하도록 검증돼 있다(essays.test.js). */
function sentenceContaining(essay, expression) {
  const needle = expression.toLowerCase();
  return essay.sentences.find((s) => s.sentence.toLowerCase().includes(needle)) || null;
}

function finishAttempt(root, essay, difficultyId, blanks, lines, typedByBlank, wordFlags, okFlags) {
  const flat = lines.flatMap((l) => l.blanks);
  const correct = okFlags.filter(Boolean).length;
  const missedExpressions = flat
    .map((b, i) => (okFlags[i] ? null : blanks[b.exprIndex]))
    .filter(Boolean)
    .map((b) => {
      const found = sentenceContaining(essay, b.expression);
      return { expression: b.expression, meaning: b.meaning, example: found?.sentence ?? "", example_ko: found?.translation ?? "" };
    });

  const body = weaveHTML(lines, (i, blank) => blankResultHTML(blank.answer, wordFlags[i], typedByBlank[i]));

  $("#basic-form-area").innerHTML = `
    <div class="card">
      ${body}
      <p class="cloze-summary">표현 ${flat.length}개 중 <b>${correct}개</b> 맞았어요.</p>
    </div>
    ${missedExpressions.length ? `<h4>💡 못 맞힌 표현 <span class="reason">(담을 것만 골라 복습에 추가하세요)</span></h4><div class="card" id="basic-exprs"></div>` : ""}
    <div class="row-end">
      <button class="btn-secondary" id="basic-retry" type="button">🔁 다시 풀기</button>
      <button class="btn-primary" id="basic-next" type="button">다음 지문 →</button>
    </div>`;

  if (missedExpressions.length) {
    const exprsEl = $("#basic-exprs");
    exprsEl.innerHTML = expressionAddHTML(missedExpressions);
    wireExpressionAdds(exprsEl, missedExpressions, "writing-basic");
  }

  appendRecord("writingBasic", { essayId: essay.id, template: essay.template, difficulty: difficultyId, total: flat.length, correct });

  $("#basic-retry").addEventListener("click", () => startPractice(essay.id, difficultyId));
  $("#basic-next").addEventListener("click", () => {
    const next = pickFresh(ESSAYS, [...recentEssayIds(), essay.id], (e) => e.id);
    if (next) startPractice(next.id, difficultyId);
  });
}

function startPractice(essayId, difficultyId) {
  const essay = findEssay(essayId);
  if (!essay) return toast("지문을 찾을 수 없습니다.");
  const template = findTemplate(essay.template);
  const blanks = blanksFor(essay, difficultyId);
  const lines = buildCloze(essay.sentences, blanks);
  const flat = lines.flatMap((l) => l.blanks);

  const root = $("#basic-content");
  root.innerHTML = `
    <div class="room-toolbar">
      <button class="btn-text" id="basic-back" type="button">← 목록</button>
      <span class="chip">${esc(template.label)}</span>
    </div>
    <div class="card question-card">
      <p class="question-text">${esc(essay.prompt)}</p>
      <details class="rubric-guide">
        <summary>🧱 이 글의 구조</summary>
        ${template.skeletonHTML}
      </details>
      <label class="small"><input type="checkbox" id="basic-toggle-ko" checked /> 한국어 해석 보기</label>
    </div>
    <div id="basic-form-area">
      <form id="basic-form">
        ${weaveHTML(lines, (i, blank) => blankInputsHTML(blank.answer, i))}
        <div class="row-end">
          <button class="btn-text" id="basic-hint" type="button">🔤 첫 글자 힌트</button>
          <button class="btn-text" id="basic-skip" type="button">⏭ 정답 보기</button>
          <button class="btn-primary" type="submit">확인하기</button>
        </div>
      </form>
    </div>`;

  $("#basic-back").addEventListener("click", renderIntro);

  $("#basic-toggle-ko").addEventListener("change", (ev) => {
    root.classList.toggle("hide-ko", !ev.target.checked);
  });

  const cells = wireCells(root);
  cells[0]?.focus();

  $("#basic-hint").addEventListener("click", () => {
    flat.forEach((blank, i) => showFirstLetters(root, blank.answer, i));
  });

  $("#basic-skip").addEventListener("click", () => {
    const typedByBlank = flat.map(() => []);
    const wordFlags = flat.map((blank) => checkWords([], blank.answer));
    const okFlags = wordFlags.map((flags) => flags.every(Boolean));
    finishAttempt(root, essay, difficultyId, blanks, lines, typedByBlank, wordFlags, okFlags);
  });

  $("#basic-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const typedByBlank = flat.map((_, i) => readWords(root, i));
    const wordFlags = flat.map((blank, i) => checkWords(typedByBlank[i], blank.answer));
    const okFlags = wordFlags.map((flags) => flags.every(Boolean));
    finishAttempt(root, essay, difficultyId, blanks, lines, typedByBlank, wordFlags, okFlags);
  });
}

export function render() {
  renderIntro();
}
