// DOM 공통 유틸.
import { RUBRICS, scoreDetail } from "./scoring.js";
import { addToDeck } from "./store.js";

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

/** 번역기 사용으로 깎인 점수 안내. 사용하지 않았으면 빈 문자열. */
export function translatorPenaltyHTML(uses, penalty, finalTotal) {
  if (!uses) return "";
  return `<p class="small muted">🌐 번역기 ${uses}회 사용 → -${penalty}점 반영 → 최종 <b>${finalTotal}점</b></p>`;
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

/** 오타·대소문자 교정. 점수에 반영하지 않고 이유 설명 없이 원문→교정만 나열한다. */
export function spellingHTML(items) {
  if (!items || items.length === 0) return "";
  return `<ul>${items
    .map((c) => `<li><span class="strike">${esc(c.original)}</span> → <span class="fixed">${esc(c.corrected)}</span></li>`)
    .join("")}</ul>`;
}

/** [[...]]로 감싼 부분을 밑줄로 렌더한다(HTML 이스케이프 후 마커만 태그로 치환). */
export function underlineHTML(text) {
  return esc(text).replace(/\[\[/g, '<u class="mark">').replace(/\]\]/g, "</u>");
}

/**
 * 답안을 한 문장씩 줄바꿈해 보여 준다. 문장마다 한국어 해석을 아래에 붙이고, [[...]] 부분은 밑줄.
 * items: [{sentence, translation}] (구버전 문자열도 허용).
 */
export function sentenceLinesHTML(items) {
  if (typeof items === "string") return `<div class="answer-line">${underlineHTML(items)}</div>`;
  if (!items || !items.length) return "";
  return items
    .map(
      (it) =>
        `<div class="answer-line">${underlineHTML(it.sentence)}<span class="answer-ko">${esc(it.translation)}</span></div>`
    )
    .join("");
}

/** 표현 목록을 개별 ➕ 버튼과 함께 렌더한다(유저가 담을 것만 복습에 추가). */
export function expressionAddHTML(expressions) {
  if (!expressions || !expressions.length) return "";
  return `<ul class="expr-list">${expressions
    .map(
      (e, i) =>
        `<li><div class="expr-head"><b>${esc(e.expression)}</b>${e.level ? ` <span class="cefr">${esc(e.level)}</span>` : ""} — ${esc(e.meaning)}</div>
          <div class="reason">${esc(e.example)}</div>
          <button class="btn-secondary expr-add" type="button" data-i="${i}">➕ 복습에 추가</button></li>`
    )
    .join("")}</ul>`;
}

/** expressionAddHTML로 그린 ➕ 버튼들을 복습 덱 추가와 연결한다. */
export function wireExpressionAdds(root, expressions, source) {
  root.querySelectorAll(".expr-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      const e = expressions[Number(btn.dataset.i)];
      const added = addToDeck([{ expression: e.expression, meaning: e.meaning, example: e.example, level: e.level, source }]);
      toast(added ? `복습에 담았어요: ${e.expression}` : "이미 복습 목록에 있어요.");
      btn.disabled = true;
      btn.textContent = added ? "✓ 담김" : "이미 있음";
    });
  });
}
