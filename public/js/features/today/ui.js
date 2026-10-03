// 🏠 오늘: 이번 주 목표 진행률 + 오늘 할 것 추천. 기본 탭이다.
// 주 단위로 계획하고 하루 할 일은 그날 유동적으로 정하는 공부 방식에 맞춘 화면.
// 계산은 전부 plan.js(순수 함수)와 srs/items.js(복습 큐)가 하고, 여기서는 그리기만 한다.
import { $, esc } from "../../shared/dom.js";
import { showView } from "../../shared/router.js";
import { getAllRecords, getProfile } from "../../shared/store.js";
import { toSeoulDate } from "../../shared/date.js";
import { todayPlan } from "../srs/items.js";
import { recommend, weekProgress } from "./plan.js";

const ROOT = "#today-content";
const UNIT_SUFFIX = { days: "일", counts: "회" };

/** 상단 탭을 가진 view. 그 밖의 view는 🎯 토플 아래 있으므로 토플 탭을 켜고 뒤로가기 바를 둔다. */
const TABBED = new Set(["today", "toefl", "conversation", "srs", "stats"]);
const BACK = { label: "오늘", to: "today" };

function areaRowHTML(area, unit) {
  const suffix = UNIT_SUFFIX[unit];
  const met = area.goal > 0 && area.done >= area.goal;
  const count = area.goal > 0 ? `${area.done}/${area.goal}${suffix}` : `${area.done}${suffix}`;
  return `<div class="goal-row">
      <span class="goal-label">${esc(area.label)}</span>
      <span class="goal-bar"><span class="goal-fill${met ? " goal-met" : ""}" data-fill="${Math.round(area.ratio * 100)}"></span></span>
      <span class="goal-count">${met ? "✓ " : ""}${esc(count)}</span>
    </div>`;
}

function suggestionHTML(item, index) {
  return `<button class="btn-secondary suggest-card" type="button" data-i="${index}">
      <b>${esc(item.label)}</b>
      <span class="small muted">${esc(item.note)}</span>
    </button>`;
}

function go(target) {
  if (TABBED.has(target.view)) return showView(target.view, { mode: target.mode || null });
  showView(target.view, { tab: "toefl", back: BACK, mode: target.mode || null });
}

function reviewLineHTML({ plan, waiting, totalDone }) {
  if (plan.length) return `오늘 복습 <b>${plan.length}개</b>${waiting > 0 ? ` · 대기 ${waiting}개` : ""}`;
  if (totalDone > 0) return `오늘 복습 <b>${totalDone}개</b> 완료 👏`;
  return "오늘 복습할 카드가 없어요.";
}

export function render() {
  const root = $(ROOT);
  const progress = weekProgress(getAllRecords(), getProfile().weeklyGoals, toSeoulDate(new Date().toISOString()));
  const review = todayPlan();
  const suggestions = recommend(progress, review.plan.length);

  const goalsSet = progress.areas.some((a) => a.goal > 0);
  const suggestBlock = suggestions.length
    ? `<div class="suggest-grid">${suggestions.map(suggestionHTML).join("")}</div>`
    : `<p class="muted">${
        goalsSet
          ? "이번 주 목표를 다 채웠어요. 하고 싶은 걸 골라서 해도 좋아요 🎉"
          : "⚙️ 설정에서 주간 목표를 정하면 오늘 할 것을 추천해 드려요."
      }</p>`;

  root.innerHTML = `
    <h2 class="page-title">🏠 오늘</h2>

    <section class="card">
      <div class="hub-group-head">
        <h3>이번 주 목표</h3>
        <span class="small muted">${esc(progress.weekStart)} ~ ${esc(progress.weekEnd)} · ${progress.daysLeft}일 남음</span>
      </div>
      ${progress.areas.map((a) => areaRowHTML(a, progress.unit)).join("")}
      <p class="small muted">단위: ${progress.unit === "days" ? "그 영역을 공부한 날 수" : "학습 횟수"} — ⚙️ 설정에서 바꿀 수 있어요.</p>
    </section>

    <section class="card">
      <h3>오늘 할 것</h3>
      <p class="reason">${reviewLineHTML(review)}</p>
      ${suggestBlock}
    </section>`;

  // CSP가 인라인 style 속성을 막으므로 막대 길이는 data-fill을 읽어 CSSOM으로 넣는다.
  root.querySelectorAll(".goal-fill").forEach((el) => {
    el.style.width = `${el.dataset.fill}%`;
  });

  root.querySelectorAll("[data-i]").forEach((btn) =>
    btn.addEventListener("click", () => go(suggestions[Number(btn.dataset.i)].target))
  );
}
