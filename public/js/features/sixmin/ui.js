// 🎙 리스닝 — BBC 6 Minute English. 목록 화면과 대본 확보만 맡고, 연습은 practice-ui.js가 한다.
//
// 레포에는 링크만 들어 있다(GitHub Actions가 수집). 대본은 이 화면에서 브라우저가 BBC에서 PDF를
// 직접 받아 풀고, 실패하면 학습을 막지 않고 BBC 원문 링크로 안내한다.
import { $, esc } from "../../shared/dom.js";
import { getRecords } from "../../shared/store.js";
import { episodes } from "./catalog.js";
import { startPractice } from "./practice-ui.js";
import { loadTranscript } from "./source.js";

const ROOT = "#sixmin-content";

function lastAttempt(episodeId) {
  const mine = getRecords("sixMin").filter((r) => r.episodeId === episodeId);
  return mine[mine.length - 1] || null;
}

function episodeCardHTML(episode) {
  const last = lastAttempt(episode.id);
  return `<button class="btn-secondary essay-card" type="button" data-episode="${esc(episode.id)}">
      <b>${esc(episode.title)}</b>
      <span class="small muted">🎙 ${esc(episode.date)} · 약 6분</span>
      ${last ? `<span class="small muted">최근 ${last.correct}/${last.total}</span>` : ""}
    </button>`;
}

async function renderList() {
  $(ROOT).innerHTML = `
    <h2 class="page-title">🎙 리스닝</h2>
    <p class="muted">BBC 6 Minute English를 듣고 구간별로 받아쓴 뒤, 토플식 이해 문제를 풀어요.<br/>
      오디오와 대본은 BBC에서 바로 받아 와요 — 받아쓰기·어휘는 AI를 쓰지 않고, 이해 문제만 에피소드당 한 번 만들어 둡니다.</p>
    <div id="sixmin-list"><p class="muted">불러오는 중...</p></div>`;

  let list;
  try {
    list = await episodes();
  } catch (e) {
    $("#sixmin-list").innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
    return;
  }
  if (!$("#sixmin-list")) return; // 화면이 이미 다른 곳으로 넘어갔으면 그리지 않는다.

  $("#sixmin-list").innerHTML = list.length
    ? `<div class="essay-grid">${list.map(episodeCardHTML).join("")}</div>`
    : `<p class="muted">아직 에피소드가 없어요. 내일 다시 확인해 주세요.</p>`;

  $(ROOT)
    .querySelectorAll("[data-episode]")
    .forEach((btn) => btn.addEventListener("click", () => open(list.find((e) => e.id === btn.dataset.episode))));
}

async function open(episode) {
  if (!episode) return;
  $(ROOT).innerHTML = `<p class="muted">BBC에서 대본을 받아오는 중이에요…</p>`;
  try {
    const transcript = await loadTranscript(episode);
    if ($(ROOT)) await startPractice(episode, transcript, { onBackToList: renderList });
  } catch (e) {
    // 대본을 못 읽어도 다른 회차는 멀쩡하다. 이 회차만 BBC 원문으로 안내한다.
    $(ROOT).innerHTML = `
      <div class="card">
        <p class="error-text">${esc(e.message)}</p>
        <p class="small muted">이 회차의 대본 파일은 형식이 달라 읽지 못했어요.
          <a href="${esc(episode.pageUrl)}" target="_blank" rel="noopener">BBC 페이지</a>에서 직접 볼 수 있어요.</p>
        <button class="btn-primary" id="sixmin-back-list" type="button">← 목록</button>
      </div>`;
    $("#sixmin-back-list").addEventListener("click", renderList);
  }
}

export function render() {
  renderList();
}
