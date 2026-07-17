// 통계 화면: 스트릭, 오늘 요약, 꺾은선그래프(평균 점수/학습량), 기능별 요약, 기록, 백업.
import { summarize, dailyStats, streak, toSeoulDate } from "./stats.js";
import { lineChartSVG } from "./chart.js";
import { getAllRecords, exportJSON, importJSON } from "../../shared/store.js";
import { download } from "../../shared/localfs.js";
import { $, esc, toast, scoreBadge } from "../../shared/dom.js";

const CHART_DAYS = 30;

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
