// DOM 공통 유틸.
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

export function correctionsHTML(corrections) {
  if (!corrections || corrections.length === 0) return "";
  return `<ul>${corrections
    .map(
      (c) =>
        `<li><span class="strike">${esc(c.original)}</span> → <span class="fixed">${esc(c.corrected)}</span><br/><span class="reason">${esc(c.reason)}</span></li>`
    )
    .join("")}</ul>`;
}
