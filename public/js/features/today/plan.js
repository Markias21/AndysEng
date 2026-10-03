// 🏠 오늘: 주간 목표 대비 진행률과 오늘 할 것 추천. 순수 함수만 — UI·저장소를 import하지 않는다.
//
// "1회"의 단위를 유저가 고른다(profile.weeklyGoals.unit):
//  - "days"(기본): 그 영역을 공부한 서울 날짜의 수. 기록 1건의 노동량이 영역마다 10배 차이나기 때문이다
//    (리딩 지문 1편 15~20분 vs 문단 연습 1문항 2분 vs 복습 1카드 20초). 날짜로 세면 그 왜곡이 사라지고
//    "매일 조금씩"을 유도한다.
//  - "counts": 기록 건수. 하루에 몰아서 해도 그만큼 센다.
import { toSeoulDate, weekRange } from "../../shared/date.js";

/** 기록 종류 → 학습 영역. 여기 없는 종류는 주간 목표에서 세지 않는다(sessions 등). */
export const AREA_OF_RECORD = {
  reading: "R",
  shortReading: "R",
  listening: "L",
  sixMin: "L",
  writing: "W",
  writingBasic: "W",
  conversation: "conversation",
  quiz: "review",
};

/**
 * 주간 목표를 두는 영역과 각 영역의 기본 진입점.
 * review(복습)는 목표를 두지 않고 "오늘 대기 수"로 따로 보여 준다 — 복습량은 SRS가 이미 상한으로 관리한다.
 */
export const GOAL_AREAS = [
  { id: "R", label: "📖 리딩", target: { view: "listening", mode: "paragraph" } },
  { id: "L", label: "🎧 리스닝", target: { view: "listening", mode: "dictation" } },
  { id: "W", label: "✍️ 글쓰기", target: { view: "writing" } },
  { id: "conversation", label: "💬 회화", target: { view: "conversation" } },
];

/**
 * 이번 주 영역별 진행 상황.
 * records: store의 records 객체 전체. goals: profile.weeklyGoals. todayKey: 서울 날짜 "YYYY-MM-DD".
 */
export function weekProgress(records, goals, todayKey) {
  const { start, end, dayIndex } = weekRange(todayKey);
  const unit = goals?.unit === "counts" ? "counts" : "days";

  // 영역 → (날짜 → 그날 기록 수). 날짜 단위와 건수 단위를 한 번의 순회로 모두 얻는다.
  const byArea = new Map();
  for (const [kind, rows] of Object.entries(records || {})) {
    const area = AREA_OF_RECORD[kind];
    if (!area) continue;
    for (const r of rows || []) {
      if (!r?.ts) continue;
      const date = toSeoulDate(r.ts);
      if (date < start || date > end) continue;
      if (!byArea.has(area)) byArea.set(area, new Map());
      const days = byArea.get(area);
      days.set(date, (days.get(date) || 0) + 1);
    }
  }

  const areas = GOAL_AREAS.map((area) => {
    const days = byArea.get(area.id) || new Map();
    const done = unit === "counts" ? [...days.values()].reduce((sum, n) => sum + n, 0) : days.size;
    const goal = Math.max(0, Math.trunc(Number(goals?.[area.id]) || 0));
    return { ...area, done, goal, ratio: goal > 0 ? Math.min(1, done / goal) : 1 };
  });

  return { unit, weekStart: start, weekEnd: end, daysLeft: 7 - dayIndex, areas };
}

const MAX_SUGGESTIONS = 3;

/**
 * 오늘 할 것 2~3개.
 * 복습 대기가 있으면 항상 첫 줄(망각곡선이 기다려 주지 않는다), 그다음 진행률이 낮은 영역 순.
 * 동률은 GOAL_AREAS의 고정 순서로 끊어 추천이 새로고침마다 흔들리지 않게 한다.
 */
export function recommend(progress, dueCount = 0) {
  const out = [];
  if (dueCount > 0) out.push({ kind: "review", label: "🔁 복습", note: `${dueCount}개 대기`, target: { view: "srs" } });

  const order = GOAL_AREAS.map((a) => a.id);
  const behind = progress.areas
    .filter((a) => a.done < a.goal)
    .sort((a, b) => a.ratio - b.ratio || order.indexOf(a.id) - order.indexOf(b.id));

  for (const area of behind.slice(0, MAX_SUGGESTIONS - out.length)) {
    const left = area.goal - area.done;
    out.push({
      kind: "area",
      id: area.id,
      label: area.label,
      note: progress.unit === "days" ? `${left}일 더` : `${left}회 더`,
      target: area.target,
    });
  }
  return out;
}
