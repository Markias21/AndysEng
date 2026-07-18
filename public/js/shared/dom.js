// DOM 공통 유틸.
import { RUBRICS, scoreDetail } from "./scoring.js";

export const $ = (sel) => document.querySelector(sel);

export function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

export function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add("hidden"), 4000);
}

export function scoreBadge(score) {
  const cls = score >= 85 ? "score-high" : score >= 60 ? "score-mid" : "score-low";
  return `<span class="score-badge ${cls}">${score}점</span>`;
}

/** S/A/B/C/F 등급 배지. */
export function gradeBadge(grade) {
  return `<span class="grade-badge grade-${grade}">${grade}</span>`;
}

/**
 * 요소별 점수 분해 표시. 종합 등급·총점 + 각 배점 요소의 등급과 받은 점수.
 * grades: { [componentKey]: "S"|"A"|"B"|"C"|"F" }
 */
export function scoreBreakdownHTML(feature, grades) {
  const d = scoreDetail(feature, grades);
  const rows = d.components
    .map(
      (c) =>
        `<div class="score-row"><span class="sc-label">${esc(c.label)}</span><span class="sc-val">${gradeBadge(c.grade)}<span class="sc-pts">${c.points}/${c.max}점</span></span></div>`
    )
    .join("");
  return `<div class="score-detail">
      <div class="score-overall">${gradeBadge(d.overall)}<b>${d.total}점</b><span class="muted small">/ ${d.maxTotal}</span></div>
      ${rows}
    </div>`;
}

/** 기능별 배점 안내(접이식). 유저가 배점 요소와 등급 환산 기준을 볼 수 있게. */
export function rubricGuideHTML(feature) {
  const rubric = RUBRICS[feature];
  const items = rubric.components.map((c) => `<li>${esc(c.label)} <b>${c.max}점</b></li>`).join("");
  return `<details class="rubric-guide">
      <summary>📋 배점 안내</summary>
      <ul>${items}</ul>
      <p class="small muted">각 요소를 S/A/B/C/F로 채점 → 그 요소 만점의 S 100% · A 80% · B 60% · C 40% · F 20%</p>
    </details>`;
}

export function correctionsHTML(corrections) {
  if (!corrections || corrections.length === 0) return "";
  return `<ul>${corrections
    .map(
      (c) =>
        `<li><span class="strike">${esc(c.original)}</span> → <span class="fixed">${esc(c.corrected)}</span><br/><span class="reason">${esc(c.reason)}</span></li>`
    )
    .join("")}</ul>`;
}
