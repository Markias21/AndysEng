// 리스닝 이해 문제 화면. 문제 세트가 없을 때만 AI를 부르고(에피소드당 평생 1회, 확인 후에만),
// 채점은 shared/mcq.js로 전부 로컬에서 끝난다 — 재도전은 몇 번을 해도 0원이다.
import { $, esc, toast } from "../../shared/dom.js";
import { CORRECT, SKIPPED, WRONG, comprehensionSummary, gradeChoices, weakTypes } from "../../shared/mcq.js";
import { getProfile } from "../../shared/store.js";
import { estimatedCost, generateSet, readySet } from "./ai.js";
import { typeLabel } from "./types.js";

const HOST = "#sixmin-quiz";
const STATUS_LABEL = { [CORRECT]: "✅ 정답", [WRONG]: "❌ 오답", [SKIPPED]: "⏭ 스킵" };

function questionHTML(q, i) {
  const options = q.options
    .map((o, j) => `<label class="mc-option"><input type="radio" name="sq${i}" value="${j}" /><span>${esc(o)}</span></label>`)
    .join("");
  return `<div class="card mc-card">
      <div class="mc-head"><span class="chip">${i + 1}</span><span class="small muted">${esc(typeLabel(q.type))}</span></div>
      <p class="mc-stem">${esc(q.stem)}</p>
      <div class="mc-options">${options}</div>
    </div>`;
}

function resultHTML(q, r, i) {
  const options = q.options
    .map((o, j) => {
      const cls = j === q.answer ? "mc-correct" : j === r.chosen ? "mc-wrong" : "";
      const mark = j === q.answer ? "✔" : j === r.chosen ? "✕" : "";
      return `<li class="${cls}"><span class="mc-mark">${mark}</span>${esc(o)}</li>`;
    })
    .join("");
  return `<div class="card mc-card">
      <div class="mc-head">
        <span class="chip">${i + 1}</span>
        <span class="small muted">${esc(typeLabel(q.type))}</span>
        <span class="mc-status">${STATUS_LABEL[r.status]}</span>
      </div>
      <p class="mc-stem">${esc(q.stem)}</p>
      <ul class="mc-review">${options}</ul>
      <p class="reason">${esc(q.explanation_ko)}</p>
      <p class="mc-evidence">📌 ${esc(q.evidence)}</p>
    </div>`;
}

function showResult(set, choices, context) {
  const results = gradeChoices(set.questions, choices);
  const summary = comprehensionSummary(results);
  const weak = weakTypes(results, typeLabel);

  $(HOST).innerHTML = `
    <div class="card">
      <p><b>${summary.correct}/${summary.total}</b> 정답 · 정답률 ${summary.accuracy === null ? "—" : `${summary.accuracy}%`}
        ${summary.skipped ? ` · 스킵 ${summary.skipped}개` : ""}</p>
      ${weak.length ? `<p class="reason">더 연습할 유형: <b>${weak.map((w) => esc(w.label)).join(", ")}</b></p>` : ""}
      <p class="reason">${esc(set.summary_ko)}</p>
    </div>
    ${set.questions.map((q, i) => resultHTML(q, results[i], i)).join("")}
    <div class="row-end"><button class="btn-secondary" id="sixmin-quiz-retry" type="button">🔁 다시 풀기</button></div>`;

  context.onGraded(summary);
  $("#sixmin-quiz-retry").addEventListener("click", () => mountForm(set, context));
}

function mountForm(set, context) {
  $(HOST).innerHTML = `
    <form id="sixmin-quiz-form">
      ${set.questions.map(questionHTML).join("")}
      <div class="row-end"><button class="btn-primary" type="submit">제출하고 채점받기</button></div>
      <p class="small muted">답하지 않은 문제는 <b>스킵</b>으로 처리돼요. 채점은 전부 로컬이라 다시 풀어도 비용이 들지 않아요.</p>
    </form>`;

  $("#sixmin-quiz-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const choices = set.questions.map((_, i) => {
      const picked = $(HOST).querySelector(`input[name="sq${i}"]:checked`);
      return picked ? Number(picked.value) : null;
    });
    showResult(set, choices, context);
  });
}

/**
 * 이해 문제를 연다. 이미 만들어 둔 세트가 있으면 바로 뜨고, 없으면 예상 비용을 확인받은 뒤에만 만든다.
 * context: { onGraded(summary) }
 */
export async function openQuiz(episode, transcript, context) {
  const host = $(HOST);
  host.innerHTML = `<p class="muted">문제를 준비하고 있어요…</p>`;
  try {
    let set = readySet(episode);
    if (!set) {
      const cost = estimatedCost(transcript, getProfile().level);
      if (!$(HOST)) return; // 확인 전에 화면을 떠났을 수 있다.
      if (!confirm(`이 에피소드는 아직 문제가 준비되어 있지 않아요.\nAI로 새로 만들면 약 $${cost.toFixed(3)}이 들어요. 계속할까요?`)) {
        toast("문제 생성을 취소했어요.");
        if ($(HOST)) $(HOST).innerHTML = "";
        context.onCancel();
        return;
      }
      if (!$(HOST)) return;
      $(HOST).innerHTML = `<p class="muted">문제를 만들고 있어요… (10초쯤 걸려요)</p>`;
      set = await generateSet(episode, transcript, getProfile().level);
    }
    if ($(HOST)) mountForm(set, context);
  } catch (e) {
    if (!$(HOST)) return;
    $(HOST).innerHTML = `<p class="error-text">${esc(e.message)}</p>
      <button class="btn-secondary" id="sixmin-quiz-retry-gen" type="button">🔄 다시 시도</button>`;
    $("#sixmin-quiz-retry-gen").addEventListener("click", () => openQuiz(episode, transcript, context));
  }
}
