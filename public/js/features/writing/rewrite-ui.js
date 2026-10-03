// 🔁 다시 쓰기 화면. 며칠 전에 쓴 글을 지난 첨삭을 숨긴 채 다시 쓴다.
//
// 핵심은 "안 보고 꺼내 쓰기"다 — 지난 답안·첨삭·원어민 답안을 처음부터 보여 주면 베껴 쓰기가 된다.
// 막히면 💡로 **한국어 뜻만** 공개한다(영어 표현은 숨긴 채). 제출하면 AI 없이 로컬에서
// 모았던 표현을 실제로 썼는지 판정하고($0), 그다음에야 지난 글과 나란히 비교한다.
// 🤖 다시 첨삭 받기는 선택이다.
import { $, esc, toast, sentenceLinesHTML } from "../../shared/dom.js";
import { appendRecord, getDeck, getRecords, getRewrites, setRewriteStatus } from "../../shared/store.js";
import { scheduleSave } from "../../shared/autosave.js";
import { toSeoulDate } from "../../shared/date.js";
import { attachTypingTimer } from "../../shared/typing-timer.js";
import { dueRewrites, splitByPicked, usedTargets } from "./rewrite.js";
import { emailPrompts } from "./email-prompts.js";

const STAGE_LABEL = { same: "같은 질문", sister: "자매 질문" };
let timer = null;
let onDone = () => {};

const todayKey = () => toSeoulDate(new Date().toISOString());

/** 오늘 할 다시 쓰기(상한 적용) + 넘친 개수. 진입점 뱃지와 화면이 같은 계산을 쓴다. */
export function todaysRewrites() {
  return dueRewrites(getRewrites(), todayKey());
}

/** 앞으로 7일 안에 돌아올 질문들. 종이에 먼저 써 두기 위한 목록이다. */
export function upcomingRewrites(days = 7) {
  const today = todayKey();
  const [y, m, d] = today.split("-").map(Number);
  const limit = new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
  return getRewrites()
    .filter((r) => r.status === "pending" && r.due <= limit)
    .sort((a, b) => (a.due < b.due ? -1 : 1));
}

function deckKeys() {
  return new Set(getDeck().map((c) => String(c.expression || "").toLowerCase()));
}

function sourceRecord(rewrite) {
  return getRecords("writing").find((r) => r.rid === rewrite.sourceRid) || null;
}

function promptCardHTML(rewrite) {
  const email = rewrite.mode === "email" ? emailPrompts.find((p) => p.id === rewrite.promptId) : null;
  return `<div class="card question-card">
      <div class="room-toolbar">
        <span class="chip">🔁 다시 쓰기 · ${esc(STAGE_LABEL[rewrite.stage] || rewrite.stage)}</span>
        <span class="toolbar-actions">
          <button class="btn-secondary btn-chip dict-open-btn" type="button">📖 사전</button>
          <button class="btn-secondary btn-chip translate-open-btn" type="button" data-feature="writing">🌐 번역기</button>
        </span>
      </div>
      <p class="question-text">${esc(rewrite.prompt)}</p>
      ${email ? `<p class="reason">받는 사람: ${esc(email.recipient)}</p>
      <ul class="bullet-list">${email.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
      <p class="writing-tip">지난번에 배운 표현을 <b>보지 않고</b> 떠올려 써 보세요. 막히면 아래 💡로 뜻만 볼 수 있어요.</p>
    </div>`;
}

function hintListHTML(targets) {
  const { picked, rest } = splitByPicked(targets, deckKeys());
  const row = (t) => `<li>${esc(t.meaning || "(뜻 없음)")}${t.fromGap ? ` <span class="chip">🧩 막혔던 곳</span>` : ""}</li>`;
  return `${picked.length ? `<p class="small muted">복습에 담은 것</p><ul class="hint-list">${picked.map(row).join("")}</ul>` : ""}
    ${rest.length ? `<p class="small muted">${picked.length ? "그 밖에 나왔던 표현" : "지난번에 나왔던 표현"}</p><ul class="hint-list">${rest.map(row).join("")}</ul>` : ""}`;
}

/** 로컬 채점 결과. AI를 쓰지 않는다. */
function resultHTML(rewrite, text) {
  const checked = usedTargets(text, rewrite.targets);
  const keys = deckKeys();
  const inDeck = checked.filter((t) => keys.has(t.expression.toLowerCase()));
  const others = checked.filter((t) => !keys.has(t.expression.toLowerCase()));
  const line = (group, label) =>
    group.length
      ? `<p class="reason">${label} <b>${group.filter((t) => t.used).length}개</b> / ${group.length}개</p>
         <ul class="target-list">${group
           .map((t) => `<li class="${t.used ? "target-used" : "target-missed"}">${t.used ? "✅" : "⬜"} <b>${esc(t.expression)}</b> <span class="reason">${esc(t.meaning)}</span></li>`)
           .join("")}</ul>`
      : "";
  const src = sourceRecord(rewrite);
  return `<h4>✍️ 표현 사용</h4>
    <div class="card">
      ${line(inDeck, "복습에 담은 표현 중")}
      ${line(others, inDeck.length ? "그 밖의 표현 중" : "지난번 표현 중")}
      <p class="small muted">AI를 쓰지 않은 로컬 판정이에요(굴절형도 인정해요). 점수를 매기지 않아요 — 쓴 개수만 봅니다.</p>
    </div>
    <h4>🪞 나란히 보기</h4>
    <div class="card compare">
      <div class="compare-col"><h5>지난번 내 글</h5><p>${esc(src?.answer || "(원래 글을 찾지 못했어요)")}</p></div>
      <div class="compare-col"><h5>이번 내 글</h5><p>${esc(text)}</p></div>
      <div class="compare-col"><h5>지난번 원어민 답안</h5>${src?.feedback?.native_answer ? sentenceLinesHTML(src.feedback.native_answer) : "<p>-</p>"}</div>
    </div>
    <div class="row-end">
      <button class="btn-secondary" id="rewrite-review" type="button">🤖 다시 첨삭 받기</button>
      <button class="btn-primary" id="rewrite-done" type="button">끝내기</button>
    </div>`;
}

function finish(rewrite, text, root) {
  const checked = usedTargets(text, rewrite.targets);
  appendRecord("writingRewrite", {
    sourceRid: rewrite.sourceRid,
    stage: rewrite.stage,
    mode: rewrite.mode,
    used: checked.filter((t) => t.used).length,
    total: checked.length,
  });
  setRewriteStatus(rewrite.id, "done");
  scheduleSave();
  timer?.stop();
  $("#rewrite-result").innerHTML = resultHTML(rewrite, text);
  $("#rewrite-done").addEventListener("click", () => onDone());
  // 🤖 다시 첨삭은 선택이다. 누를 때만 기존 첨삭 1회 비용이 든다.
  $("#rewrite-review").addEventListener("click", () => startReview(rewrite, text, root));
  $("#rewrite-form").classList.add("hidden");
}

async function startReview(rewrite, text, root) {
  const btn = $("#rewrite-review");
  btn.disabled = true;
  btn.textContent = "첨삭 중...";
  try {
    const { reviewDiscussion, reviewEmail } = await import("./review.js");
    const { feedbackHTML } = await import("./feedback-ui.js");
    const extra = { rewriteOf: rewrite.sourceRid, stage: rewrite.stage };
    const email = rewrite.mode === "email" ? emailPrompts.find((p) => p.id === rewrite.promptId) : null;
    const r = email
      ? await reviewEmail(email, text, extra)
      : await reviewDiscussion(rewrite.prompt, text, extra);
    root.insertAdjacentHTML("beforeend", `<div class="result-section">${feedbackHTML(r, rewrite.mode)}</div>`);
    $("#writing-next").textContent = "끝내기";
    $("#writing-next").addEventListener("click", () => onDone());
    btn.remove();
  } catch (e) {
    toast(e.message);
    btn.disabled = false;
    btn.textContent = "🤖 다시 첨삭 받기";
  }
}

/** 다시 쓰기 하나를 연다. root는 그릴 컨테이너, back은 목록으로 돌아가는 콜백. */
export function openRewrite(rewrite, root, back) {
  onDone = back;
  root.innerHTML = `
    <div class="room-toolbar"><button class="btn-text" id="rewrite-back" type="button">← 다시 쓰기 목록</button></div>
    ${promptCardHTML(rewrite)}
    <form id="rewrite-form">
      <textarea id="rewrite-input" rows="6" placeholder="지난번 표현을 떠올리며 다시 써 보세요. 막히면 (한국어)로 표시하고 넘어가도 돼요..."></textarea>
      <span class="chip hidden" id="rewrite-timer"></span>
      <div class="row-end">
        <button class="btn-text" id="rewrite-hint" type="button">💡 지난번 표현 뜻 보기</button>
        <button class="btn-text" id="rewrite-skip" type="button">건너뛰기</button>
        <button class="btn-primary" type="submit">제출</button>
      </div>
      <div id="rewrite-hints" class="card hidden"></div>
    </form>
    <div id="rewrite-result"></div>`;

  timer = attachTypingTimer([$("#rewrite-input")], [$("#rewrite-timer")]);
  $("#rewrite-back").addEventListener("click", () => back());
  $("#rewrite-hint").addEventListener("click", () => {
    const box = $("#rewrite-hints");
    box.innerHTML = hintListHTML(rewrite.targets);
    box.classList.remove("hidden");
    $("#rewrite-hint").disabled = true;
  });
  $("#rewrite-skip").addEventListener("click", () => {
    if (!confirm("이 다시 쓰기를 건너뛸까요? 불이익은 없어요.")) return;
    setRewriteStatus(rewrite.id, "skipped");
    scheduleSave();
    back();
  });
  $("#rewrite-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = $("#rewrite-input").value.trim();
    if (!text) return toast("먼저 글을 써 주세요.");
    finish(rewrite, text, root);
  });
}

/**
 * 🔁 다시 쓰기 목록. 오늘 할 것 + 앞으로 7일 안에 돌아올 질문.
 * 뒤쪽 목록과 🖨 인쇄는 오프라인 시간에 종이로 먼저 쓰기 위한 것이다(하루 온라인 1~2시간 제약).
 */
export function renderRewriteList(root, onBack) {
  const { today, overflow } = todaysRewrites();
  const upcoming = upcomingRewrites().filter((r) => !today.some((t) => t.id === r.id));
  root.innerHTML = `
    <div class="room-toolbar"><button class="btn-text" id="rewrite-to-modes" type="button">← 유형 고르기</button></div>
    <h3>🔁 오늘 다시 쓸 글</h3>
    ${today.length
      ? `<div class="essay-grid">${today
          .map(
            (r) => `<button class="btn-secondary essay-card" type="button" data-id="${esc(r.id)}">
              <b>${esc(r.prompt)}</b>
              <span class="small muted">${esc(STAGE_LABEL[r.stage] || r.stage)} · ${esc(r.due)} 예정 · 표현 ${r.targets.length}개</span>
            </button>`
          )
          .join("")}</div>`
      : `<p class="muted">오늘 다시 쓸 글이 없어요. 글을 쓰고 첨삭을 받으면 3일 뒤에 돌아와요.</p>`}
    ${overflow > 0 ? `<p class="small muted">대기 중 ${overflow}개는 내일 이어서 할 수 있어요.</p>` : ""}
    ${upcoming.length
      ? `<h3>🗓 이번 주에 돌아올 질문</h3>
        <p class="small muted">온라인이 아닐 때 종이에 먼저 써 두면 좋아요.</p>
        <ol class="upcoming-list">${upcoming
          .map((r) => `<li><span class="small muted">${esc(r.due)} · ${esc(STAGE_LABEL[r.stage] || r.stage)}</span><br/>${esc(r.prompt)}</li>`)
          .join("")}</ol>
        <div class="row-end"><button class="btn-secondary" id="rewrite-print" type="button">🖨 인쇄하기</button></div>`
      : ""}`;

  $("#rewrite-to-modes").addEventListener("click", () => onBack());
  $("#rewrite-print")?.addEventListener("click", () => window.print());
  root.querySelectorAll("[data-id]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const rewrite = today.find((r) => r.id === btn.dataset.id);
      if (rewrite) openRewrite(rewrite, root, () => renderRewriteList(root, onBack));
    })
  );
}
