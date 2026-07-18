// 통계 화면: 스트릭, 오늘 요약, 학습 달력, 꺾은선그래프, 기능별 요약, 기록, 백업.
import { summarize, dailyStats, streak, toSeoulDate, calendarMonth } from "./stats.js";
import { lineChartSVG } from "./chart.js";
import { overallGrade } from "../../shared/scoring.js";
import { getAllRecords, exportJSON, importJSON } from "../../shared/store.js";
import { download } from "../../shared/localfs.js";
import { $, esc, toast, scoreBadge } from "../../shared/dom.js";

const CHART_DAYS = 30;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 현재 보고 있는 달력의 연/월(1~12). 월 이동 버튼으로 바뀐다.
let calView = null;

function shiftMonth(delta) {
  let { year, month } = calView;
  month += delta;
  if (month < 1) {
    month = 12;
    year -= 1;
  } else if (month > 12) {
    month = 1;
    year += 1;
  }
  calView = { year, month };
}

function calCell(cell, today) {
  if (!cell.date) return `<div class="cal-cell cal-empty"></div>`;
  const grade = cell.avgScore != null ? overallGrade(cell.avgScore / 100) : null;
  const cls = grade ? `cal-${grade}` : "cal-none";
  const isToday = cell.date === today ? " cal-today" : "";
  const chip = (emoji, v) => (v != null ? `<span class="cal-chip">${emoji}${Math.round(v)}</span>` : "");
  const chips = chip("💬", cell.convAvg) + chip("✍️", cell.writeAvg) + chip("💡", cell.exprAvg);
  const title = cell.avgScore != null ? `${cell.date} · 평균 ${cell.avgScore}점 (${grade})` : cell.date;
  return `<div class="cal-cell ${cls}${isToday}" title="${title}">
      <div class="cal-day">${cell.day}</div>
      <div class="cal-chips">${chips}</div>
    </div>`;
}

function calendarSection(daily, today) {
  if (!calView) {
    const [y, m] = today.split("-").map(Number);
    calView = { year: y, month: m };
  }
  const cal = calendarMonth(daily, calView.year, calView.month);
  const head = WEEKDAYS.map(
    (w, i) => `<div class="cal-head${i === 0 ? " cal-sun" : ""}${i === 6 ? " cal-sat" : ""}">${w}</div>`
  ).join("");
  const body = cal.weeks.map((week) => week.map((c) => calCell(c, today)).join("")).join("");
  const legend = ["S", "A", "B", "C", "F"].map((g) => `<span class="cal-leg cal-${g}">${g}</span>`).join("");
  return `
    <div class="card">
      <div class="cal-nav">
        <button class="cal-arrow" data-cal-prev aria-label="이전 달">◀</button>
        <h3 class="cal-title">📅 ${cal.year}년 ${cal.month}월</h3>
        <button class="cal-arrow" data-cal-next aria-label="다음 달">▶</button>
      </div>
      <div class="cal-grid">${head}${body}</div>
      <div class="cal-legend">
        ${legend}
        <span class="muted small">칸 색 = 그날 평균 등급 · 💬회화 ✍️글쓰기 💡표현</span>
      </div>
    </div>`;
}

function statBlock(title, s) {
  return `
    <div class="card">
      <h3 class="card-title">${title}</h3>
      <div class="stat-row"><span>학습한 문장</span><b>${s.count}개</b></div>
      <div class="stat-row"><span>최근 10문장 평균</span><b>${s.avg10 ?? "-"}${s.avg10 != null ? "점" : ""}</b></div>
      <div class="stat-row"><span>최근 100문장 평균</span><b>${s.avg100 ?? "-"}${s.avg100 != null ? "점" : ""}</b></div>
      <div class="stat-row"><span>최근 점수</span><span>${s.recentScores.length ? s.recentScores.map(scoreBadge).join(" ") : "-"}</span></div>
    </div>`;
}

function summaryGrid(daily, today, streakDays) {
  const t = daily.find((d) => d.date === today) || { topics: 0, spoken: 0, written: 0, avgScore: null };
  const cells = [
    ["🔥 연속 학습", `${streakDays}일`],
    ["오늘 주제", `${t.topics}개`],
    ["오늘 말한 문장", `${t.spoken}개`],
    ["오늘 쓴 문장", `${t.written}개`],
    ["오늘 평균", t.avgScore != null ? `${t.avgScore}점` : "-"],
  ];
  return `<div class="stat-grid">${cells
    .map(([label, num]) => `<div class="card stat-card"><div class="stat-num">${num}</div><div class="stat-label">${label}</div></div>`)
    .join("")}</div>`;
}

function charts(daily) {
  const recent = daily.slice(-CHART_DAYS);
  const label = (d) => d.date.slice(5); // MM-DD
  const scorePoints = recent.map((d) => ({ label: label(d), value: d.avgScore }));
  const volumePoints = recent.map((d) => ({ label: label(d), value: d.spoken + d.written }));
  return `
    <div class="card">
      <h3 class="card-title">📈 일별 평균 점수 (최근 ${CHART_DAYS}일)</h3>
      ${lineChartSVG(scorePoints, { yMin: 0, yMax: 100, unit: "점" })}
    </div>
    <div class="card">
      <h3 class="card-title">📊 일별 학습량 (문장 수)</h3>
      ${lineChartSVG(volumePoints, { yMin: 0, unit: "개" })}
    </div>`;
}

function historyDetails(records) {
  const writingHistory = records.writing
    .slice()
    .reverse()
    .map(
      (h) => `<div class="history-item">
        <div class="hi-date">${new Date(h.ts).toLocaleString("ko-KR")} ${scoreBadge(h.score)}</div>
        <b>Q.</b> ${esc(h.question)}<br/><b>A.</b> ${esc(h.answer)}<br/>
        <b>교정:</b> ${esc(h.feedback.corrected_answer)}<br/>
        <b>모범 답안:</b> ${esc(h.feedback.native_answer)}
      </div>`
    )
    .join("");
  const exprHistory = records.expression
    .slice()
    .reverse()
    .map(
      (h) => `<div class="history-item">
        <div class="hi-date">${new Date(h.ts).toLocaleString("ko-KR")} ${scoreBadge(h.score)}</div>
        <b>${esc(h.expression)}</b><br/>${esc(h.sentence)}
      </div>`
    )
    .join("");
  return `
    <details class="history"><summary>✍️ 글쓰기 피드백 기록 (${records.writing.length})</summary>${writingHistory || '<p class="muted">아직 기록이 없어요.</p>'}</details>
    <details class="history"><summary>💡 표현 학습 기록 (${records.expression.length})</summary>${exprHistory || '<p class="muted">아직 기록이 없어요.</p>'}</details>`;
}

export function render() {
  const records = getAllRecords();
  const daily = dailyStats(records);
  const today = toSeoulDate(new Date().toISOString());
  const streakDays = streak(daily.map((d) => d.date), today);

  $("#stats-content").innerHTML = `
    ${summaryGrid(daily, today, streakDays)}
    ${calendarSection(daily, today)}
    ${charts(daily)}
    ${statBlock("💬 회화", summarize(records.conversation))}
    ${statBlock("✍️ 글쓰기", summarize(records.writing))}
    ${statBlock("💡 표현", summarize(records.expression))}
    ${historyDetails(records)}
    <div class="card">
      <h3 class="card-title">💾 데이터 백업</h3>
      <p class="muted small card-desc">학습 기록과 복습 덱을 JSON 파일로 내보내거나 다른 기기에서 가져올 수 있어요.</p>
      <div class="row-start">
        <button class="btn-secondary" id="backup-export">내보내기</button>
        <button class="btn-secondary" id="backup-import">가져오기</button>
        <input type="file" id="backup-file" accept="application/json" class="hidden" />
      </div>
    </div>`;

  $("[data-cal-prev]").addEventListener("click", () => {
    shiftMonth(-1);
    render();
  });
  $("[data-cal-next]").addEventListener("click", () => {
    shiftMonth(1);
    render();
  });

  $("#backup-export").addEventListener("click", () => {
    download(`andyseng-backup-${today}.json`, exportJSON(), "application/json");
    toast("백업 파일을 내려받았어요.");
  });
  $("#backup-import").addEventListener("click", () => $("#backup-file").click());
  $("#backup-file").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      importJSON(await file.text());
      toast("백업을 가져왔어요.");
      render();
    } catch (e) {
      toast(e.message);
    }
  });
}
