// 🎯 토플 허브: 2026 신형 토플의 과제 유형별 진입점. 영역(R/L/S/W) 카드 + 심화·자유 학습.
// 화면 이동만 맡는다 — 실제 연습은 각 기능의 view가 한다. 기능 코드는 건드리지 않는다.
import { $, esc } from "../../shared/dom.js";
import { showView } from "../../shared/router.js";
import { EXTRAS, SECTIONS } from "./sections.js";

const ROOT = "#toefl-content";
const BACK = { label: "토플", to: "toefl" };

function taskHTML(task, index, groupId) {
  // 첫 줄은 "이름 … 표시", 둘째 줄은 설명. 한 줄에 다 넣으면 좁은 화면에서 화살표만 떨어져 나온다.
  const hint = task.hint ? `<span class="task-hint small muted">${esc(task.hint)}</span>` : "";
  if (task.soon) {
    return `<div class="task-row task-soon">
        <span class="task-head"><span class="task-label">${esc(task.label)}</span><span class="chip">준비 중 · ${esc(task.soon)}</span></span>
        ${hint}
      </div>`;
  }
  return `<button class="task-row task-open" type="button" data-group="${esc(groupId)}" data-task="${index}">
      <span class="task-head"><span class="task-label">${esc(task.label)}</span><span class="task-go">→</span></span>
      ${hint}
    </button>`;
}

function groupHTML(group) {
  const note = group.note ? `<span class="small muted">${esc(group.note)}</span>` : "";
  return `<section class="card hub-group">
      <div class="hub-group-head"><h3>${esc(group.label)}</h3>${note}</div>
      ${group.tasks.map((t, i) => taskHTML(t, i, group.id)).join("")}
    </section>`;
}

/** data-group/data-task로 어떤 과제를 눌렀는지 되찾는다(핸들러를 한 번만 붙이기 위함). */
function findTask(groupId, index) {
  const group = groupId === "extras" ? EXTRAS : SECTIONS.find((s) => s.id === groupId);
  return group?.tasks[Number(index)] || null;
}

export function render() {
  const root = $(ROOT);
  root.innerHTML = `
    <h2 class="page-title">🎯 토플</h2>
    <p class="muted">2026-01-21 개편 이후의 과제 유형이에요. 아직 없는 과제는 "준비 중"으로 적어 뒀어요.</p>
    ${SECTIONS.map(groupHTML).join("")}
    ${groupHTML({ ...EXTRAS, id: "extras" })}`;

  root.querySelectorAll(".task-open").forEach((btn) =>
    btn.addEventListener("click", () => {
      const task = findTask(btn.dataset.group, btn.dataset.task);
      if (task?.view) showView(task.view, { tab: "toefl", back: BACK, mode: task.mode || null });
    })
  );
}
