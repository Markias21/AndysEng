// 짧은 학습(3분 학습): VOA "Words and Their Stories" 짧은 프로그램으로 오디오+대본을 함께 듣고
// 읽으며 받아쓰기 연습을 한다. 화면 이동만 맡고, 실제 연습은 practice-ui.js가 한다.
//
// 지문은 AI가 만들지 않는다(GitHub Actions가 매일 모아 둔 정적 JSON) — 채점도 로컬 받아쓰기
// 비교라 AI를 전혀 쓰지 않는다(비용 0원).
import { $, esc } from "../../shared/dom.js";
import { getRecords } from "../../shared/store.js";
import { articlesOf, loadArticle } from "./catalog.js";
import { startPractice } from "./practice-ui.js";

const ROOT = "#listening-content";

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

async function renderList() {
  const root = $(ROOT);
  root.innerHTML = `
    <h2 class="page-title">🎧 3분 학습</h2>
    <p class="muted">VOA "Words and Their Stories" 짧은 프로그램을 듣고 읽으며 받아써요.<br/>
      AI를 전혀 쓰지 않아요 — 오디오·대본 모두 사전 수집된 정적 데이터, 채점도 로컬이에요.</p>
    <div id="listening-list"><p class="muted">불러오는 중...</p></div>`;

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
    await startPractice(await loadArticle(articleId), { onBackToList: renderList });
  } catch (e) {
    $(ROOT).insertAdjacentHTML("beforeend", `<p class="error-text">${esc(e.message)}</p>`);
  }
}

export function render() {
  renderList();
}
