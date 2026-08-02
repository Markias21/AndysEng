// 리딩 공부: VOA Learning English 지문을 읽고 토플식 문제 → 요약·재진술까지 한 화면에서 푼다.
// 화면 이동만 맡고, 실제 연습·채점은 practice-ui.js / result-ui.js가 한다.
//
// 지문은 AI가 만들지 않는다 — GitHub Actions가 매일 모아 둔 정적 JSON을 읽는다(비용 0원).
import { $, esc, toast } from "../../shared/dom.js";
import { getRecords } from "../../shared/store.js";
import { CATEGORIES, articlesOf, categoryLabel, loadArticle } from "./catalog.js";
import { startPractice } from "./practice-ui.js";

const ROOT = "#reading-content";

function lastAttempt(articleId) {
  const mine = getRecords("reading").filter((r) => r.articleId === articleId);
  return mine[mine.length - 1] || null;
}

function articleCardHTML(article) {
  const last = lastAttempt(article.id);
  const lastLine = last
    ? `<span class="small muted">최근 ${last.correct}/${last.total}${last.score !== undefined ? ` · ${last.score}점` : ""}</span>`
    : "";
  return `<button class="btn-secondary essay-card" type="button" data-article="${esc(article.id)}">
      <b>${esc(article.title)}</b>
      <span class="small muted">${article.words}단어 · 약 ${Math.max(2, Math.round(article.words / 150))}분</span>
      ${lastLine}
    </button>`;
}

function renderCategories() {
  const root = $(ROOT);
  root.innerHTML = `
    <h2 class="page-title">📖 리딩</h2>
    <p class="muted">VOA Learning English 지문으로 토플식 리딩을 연습해요.<br/>
      객관식·빈칸은 AI 없이 채점하고, 요약과 재진술만 AI가 첨삭해요.</p>
    <div class="category-grid">${CATEGORIES.map(
      (c) => `<button class="btn-secondary category-btn" type="button" data-category="${c.id}">${esc(c.label)}</button>`
    ).join("")}</div>`;
  root.querySelectorAll("[data-category]").forEach((btn) =>
    btn.addEventListener("click", () => renderList(btn.dataset.category))
  );
}

async function renderList(categoryId) {
  const root = $(ROOT);
  root.innerHTML = `<div class="room-toolbar">
      <button class="btn-text" id="reading-back-cats" type="button">← 카테고리</button>
      <span class="chip">${esc(categoryLabel(categoryId))}</span>
    </div>
    <p class="muted">불러오는 중...</p>`;
  $("#reading-back-cats").addEventListener("click", renderCategories);

  let articles;
  try {
    articles = await articlesOf(categoryId);
  } catch (e) {
    root.insertAdjacentHTML("beforeend", `<p class="error-text">${esc(e.message)}</p>`);
    return;
  }
  // 화면이 이미 다른 곳으로 넘어갔으면 그리지 않는다.
  if (!$("#reading-back-cats")) return;

  const list = articles.length
    ? `<div class="essay-grid">${articles.map(articleCardHTML).join("")}</div>`
    : `<p class="muted">아직 이 카테고리의 지문이 없어요.</p>`;
  root.querySelector(".muted").outerHTML = list;

  root.querySelectorAll("[data-article]").forEach((btn) =>
    btn.addEventListener("click", () => open(btn.dataset.article, categoryId))
  );
}

async function open(articleId, categoryId) {
  const context = {
    onBackToList: () => renderList(categoryId),
    onBackToCategories: renderCategories,
    onRetry: (article) => startPractice(article, context),
  };
  try {
    await startPractice(await loadArticle(articleId), context);
  } catch (e) {
    toast(e.message);
  }
}

export function render() {
  renderCategories();
}
