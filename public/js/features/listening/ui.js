// 🎧 3분 학습 탭. 두 모드를 다룬다: 듣기 연습(dictation, VOA 짧은 프로그램 받아쓰기)과
// 문단 연습(paragraph, 리딩 지문 문단 하나로 훈련 — features/short-reading/에 구현).
// 화면 이동만 맡고, 실제 연습은 practice-ui.js(듣기)/short-reading/ui.js(문단)가 한다.
import { $, esc } from "../../shared/dom.js";
import { getRecords } from "../../shared/store.js";
import { articlesOf, loadArticle } from "./catalog.js";
import { startPractice } from "./practice-ui.js";
import * as shortReading from "../short-reading/ui.js";

const ROOT = "#listening-content";

const MODES = [
  { id: "dictation", label: "🎧 듣기 연습" },
  { id: "paragraph", label: "⚡ 문단 연습" },
];

function renderModePicker() {
  const root = $(ROOT);
  root.innerHTML = `
    <h2 class="page-title">🎧 3분 학습</h2>
    <p class="muted">1~3분이면 끝나는 짧은 학습이에요. AI 사용은 최소화했어요.</p>
    <div class="category-grid">${MODES.map((m) => `<button class="btn-secondary category-btn" type="button" data-mode="${m.id}">${esc(m.label)}</button>`).join("")}</div>`;
  root.querySelectorAll("[data-mode]").forEach((btn) => btn.addEventListener("click", () => openMode(btn.dataset.mode)));
}

function openMode(mode) {
  if (mode === "paragraph") return shortReading.start(renderModePicker);
  renderDictationList();
}

function lastAttempt(articleId) {
  const mine = getRecords("listening").filter((r) => r.articleId === articleId);
  return mine[mine.length - 1] || null;
}

function articleCardHTML(article) {
  const last = lastAttempt(article.id);
  const lastLine = last ? `<span class="small muted">최근 ${last.correct}/${last.total}</span>` : "";
  return `<button class="btn-secondary essay-card" type="button" data-article="${esc(article.id)}">
      <b>${esc(article.title)}</b>
      <span class="small muted">🎧 ${article.words}단어 · 약 ${Math.max(1, Math.round(article.words / 150))}분</span>
      ${lastLine}
    </button>`;
}

async function renderDictationList() {
  const root = $(ROOT);
  root.innerHTML = `
    <div class="room-toolbar"><button class="btn-text" id="listening-back-mode" type="button">← 3분 학습</button></div>
    <h2 class="page-title">🎧 듣기 연습</h2>
    <p class="muted">VOA "Words and Their Stories" 짧은 프로그램을 듣고 읽으며 받아써요.<br/>
      AI를 전혀 쓰지 않아요 — 오디오·대본 모두 사전 수집된 정적 데이터, 채점도 로컬이에요.</p>
    <div id="listening-list"><p class="muted">불러오는 중...</p></div>`;
  $("#listening-back-mode").addEventListener("click", renderModePicker);

  let articles;
  try {
    articles = await articlesOf();
  } catch (e) {
    $("#listening-list").innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
    return;
  }
  if (!$("#listening-list")) return; // 화면이 이미 다른 곳으로 넘어갔으면 그리지 않는다.

  $("#listening-list").innerHTML = articles.length
    ? `<div class="essay-grid">${articles.map(articleCardHTML).join("")}</div>`
    : `<p class="muted">아직 지문이 없어요. 내일 다시 확인해 주세요.</p>`;

  root.querySelectorAll("[data-article]").forEach((btn) => btn.addEventListener("click", () => open(btn.dataset.article)));
}

async function open(articleId) {
  try {
    await startPractice(await loadArticle(articleId), { onBackToList: renderDictationList });
  } catch (e) {
    $(ROOT).insertAdjacentHTML("beforeend", `<p class="error-text">${esc(e.message)}</p>`);
  }
}

export function render() {
  renderModePicker();
}
