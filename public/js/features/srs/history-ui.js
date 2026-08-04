// 복습 기록 모달: 카드 하나가 몇 번째 시도에서 맞았는지/틀렸는지 시간순으로 보여준다.
import { historyFor } from "./history.js";
import { nounFor, withParticle } from "./labels.js";
import { getRecords } from "../../shared/store.js";
import { $ } from "../../shared/dom.js";

function rowHTML(entry) {
  const date = new Date(entry.ts).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return `<div class="history-item">
    <div class="hi-date">${date}</div>
    <span class="chip ${entry.correct ? "chip-green" : "chip-red"}">${entry.attempt}번째 시도 · ${entry.correct ? "✅ 정답" : "❌ 오답"}</span>
    ${entry.score != null ? ` <span class="reason">예문 채점 ${entry.score}점</span>` : ""}
  </div>`;
}

export function openHistory(item) {
  const entries = historyFor(getRecords("quiz"), item);
  $("#srs-history-title").textContent = `📜 ${item.term} 기록`;
  $("#srs-history-body").innerHTML = entries.length
    ? entries.slice().reverse().map(rowHTML).join("")
    : `<p class="muted">아직 이 ${withParticle(nounFor(item.kind), "을", "를")} 복습한 기록이 없어요.</p>`;
  $("#srs-history-modal").classList.remove("hidden");
}

function closeModal() {
  $("#srs-history-modal").classList.add("hidden");
}

export function init() {
  $("#srs-history-close").addEventListener("click", closeModal);
  $("#srs-history-modal").addEventListener("click", (ev) => {
    if (ev.target.id === "srs-history-modal") closeModal();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !$("#srs-history-modal").classList.contains("hidden")) closeModal();
  });
}
