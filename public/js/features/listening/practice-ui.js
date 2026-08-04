// 짧은 학습 연습 화면. 오디오+대본을 함께 보여주고, 난이도별로 뚫은 빈칸을 받아쓰게 한다.
// 채점은 shared/cloze.js 기반 로컬 비교뿐이라 AI를 전혀 쓰지 않는다(비용 0원).
import { blankInputsHTML, blankResultHTML, readWords, showFirstLetters, weaveHTML, wireCells } from "../../shared/cloze-view.js";
import { $, esc } from "../../shared/dom.js";
import { appendRecord, getProfile, setProfile } from "../../shared/store.js";
import { DEFAULT_DIFFICULTY, DIFFICULTIES, buildDictation, findDifficulty, gradeDictation } from "../../shared/dictation.js";

const ROOT = "#listening-content";

function currentDifficulty() {
  return findDifficulty(getProfile().listenDifficulty)?.id || DEFAULT_DIFFICULTY;
}

function passageHeaderHTML(article) {
  const glossary = article.glossary?.length
    ? `<details class="rubric-guide"><summary>📗 어휘 풀이 (VOA 제공)</summary>
        <ul>${article.glossary.map((g) => `<li><b>${esc(g.word)}</b> <i>${esc(g.pos)}.</i> ${esc(g.meaning)}</li>`).join("")}</ul>
      </details>`
    : "";
  return `<article class="card reading-passage">
      <h3>${esc(article.title)}</h3>
      <p class="small muted">VOA Words and Their Stories · ${article.words}단어 · 약 ${Math.max(1, Math.round(article.words / 150))}분</p>
      <audio controls preload="none" class="audio-player" src="${esc(article.audio)}"></audio>
      ${glossary}
    </article>`;
}

function finishAttempt(root, article, difficultyId, context, lines, typedByBlank, flags) {
  const total = flags.length;
  const correct = flags.filter(Boolean).length;
  const body = weaveHTML(lines, (i, blank) => blankResultHTML(blank.answer, [flags[i]], [typedByBlank[i]?.[0] ?? ""]));

  $("#listening-form-area").innerHTML = `
    <div class="card">
      ${body}
      <p class="cloze-summary">빈칸 ${total}개 중 <b>${correct}개</b> 맞았어요.</p>
    </div>
    <div class="row-end">
      <button class="btn-secondary" id="listening-retry" type="button">🔁 다시 풀기</button>
      <button class="btn-primary" id="listening-list-btn" type="button">← 목록</button>
    </div>`;

  appendRecord("listening", { articleId: article.id, category: article.category, difficulty: difficultyId, total, correct });

  $("#listening-retry").addEventListener("click", () => mountForm(root, article, difficultyId, context));
  $("#listening-list-btn").addEventListener("click", context.onBackToList);
}

function mountForm(root, article, difficultyId, context) {
  const lines = buildDictation(article.paragraphs, difficultyId);
  const flat = lines.flatMap((l) => l.blanks);

  $("#listening-form-area").innerHTML = `
    <form id="listening-form">
      ${weaveHTML(lines, (i, blank) => blankInputsHTML(blank.answer, i))}
      <div class="row-end">
        <button class="btn-text" id="listening-hint" type="button">🔤 첫 글자 힌트</button>
        <button class="btn-primary" type="submit">채점하기</button>
      </div>
    </form>`;

  const cells = wireCells(root);
  cells[0]?.focus();

  $("#listening-hint").addEventListener("click", () => {
    flat.forEach((blank, i) => showFirstLetters(root, blank.answer, i));
  });

  $("#listening-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const typedByBlank = flat.map((_, i) => readWords(root, i));
    const flags = gradeDictation(lines, typedByBlank);
    finishAttempt(root, article, difficultyId, context, lines, typedByBlank, flags);
  });
}

function mountDifficultyPicker(root, article, context) {
  const difficultyId = currentDifficulty();
  root.querySelector("#listening-diff-picker").innerHTML = DIFFICULTIES.map(
    (d) => `<button class="btn-chip${d.id === difficultyId ? " active" : ""}" type="button" data-diff="${d.id}">${esc(d.label)}</button>`
  ).join("");
  root.querySelector("#listening-diff-desc").textContent = findDifficulty(difficultyId).ko;

  root.querySelectorAll("[data-diff]").forEach((btn) =>
    btn.addEventListener("click", () => {
      setProfile({ listenDifficulty: btn.dataset.diff });
      mountDifficultyPicker(root, article, context);
    })
  );

  mountForm(root, article, difficultyId, context);
}

/** 짧은 학습 지문을 열어 오디오+받아쓰기 화면을 그린다. context: { onBackToList } */
export async function startPractice(article, context) {
  const root = $(ROOT);
  root.innerHTML = `
    <div class="room-toolbar">
      <button class="btn-text" id="listening-back" type="button">← 목록</button>
      <span class="chip">🎧 3분 학습</span>
    </div>
    ${passageHeaderHTML(article)}
    <div class="diff-picker" id="listening-diff-picker"></div>
    <p class="small muted" id="listening-diff-desc"></p>
    <div id="listening-form-area"></div>`;

  $("#listening-back").addEventListener("click", context.onBackToList);
  mountDifficultyPicker(root, article, context);
}
