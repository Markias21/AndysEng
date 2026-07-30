// 오늘의 복습 큐를 만드는 도메인 로직. 순수 함수만 — 저장소/UI를 import하지 않는다.
// due 카드를 전부 내보내면 표현이 쌓일수록 하루 부담이 무한히 커지므로,
// 하루 상한(신규/총량)으로 잘라내고 남은 것은 다음 날로 넘긴다.
import { toSeoulDate } from "../../shared/date.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 오늘 이미 처리한 개수. quizRecords: [{ts, isNew}] (store의 records.quiz).
 * isNew가 없는 옛 기록은 복습으로 센다.
 */
export function todaysCounts(quizRecords, todayKey) {
  let totalDone = 0;
  let newDone = 0;
  for (const r of quizRecords) {
    if (toSeoulDate(r.ts) !== todayKey) continue;
    totalDone += 1;
    if (r.isNew) newDone += 1;
  }
  return { totalDone, newDone };
}

/**
 * 상대 연체도 = 연체일 / 간격. 잊었을 위험이 큰 순서를 재는 척도다.
 * 1일 간격 카드가 5일 밀린 것(5.0)과 120일 간격 카드가 5일 밀린 것(0.04)은 위험도가 전혀 다르므로,
 * 절대 연체일로 줄 세우는 것보다 낫다.
 */
function overdueRatio(card, now) {
  return (now - card.due) / DAY_MS / Math.max(card.interval || 1, 1);
}

/**
 * 표현/단어를 남은 개수 비율에 맞춰 고르게 섞는다.
 * 한 종류를 연달아 몰아서 하는 것(블록킹)보다 번갈아 하는 것(인터리빙)이 장기 파지에 유리하다.
 */
function interleaveByKind(items) {
  const expr = items.filter((it) => it.kind !== "word");
  const words = items.filter((it) => it.kind === "word");
  const out = [];
  let ei = 0;
  let wi = 0;
  while (ei < expr.length || wi < words.length) {
    const takeExpr = wi >= words.length || (ei < expr.length && (ei + 1) / expr.length <= (wi + 1) / words.length);
    out.push(takeExpr ? expr[ei++] : words[wi++]);
  }
  return out;
}

/**
 * 오늘 복습할 큐를 만든다.
 * items: [{kind, raw}] (레벨 필터를 이미 통과한 전체 항목)
 * newLimit/reviewLimit: 하루 신규 상한 / 하루 총량 상한
 * newDone/totalDone: 오늘 이미 한 신규 수 / 전체 수
 */
export function buildSession(items, { now, newLimit, reviewLimit, newDone = 0, totalDone = 0 }) {
  const fresh = [];
  const seen = [];
  for (const it of items) {
    if (it.raw.due > now) continue;
    (it.raw.reps ? seen : fresh).push(it);
  }
  // 종류를 먼저 섞어 두고 그 위에 안정 정렬을 얹는다. 이러면 위험도가 같은 카드들의 순서가
  // 종류별 뭉치가 아니라 번갈아 나오는 순서가 되어, 상한으로 잘라도 한 종류만 담기지 않는다.
  const byRisk = interleaveByKind(seen).sort((a, b) => overdueRatio(b.raw, now) - overdueRatio(a.raw, now));
  const byAge = interleaveByKind(fresh).sort((a, b) => (a.raw.addedAt || 0) - (b.raw.addedAt || 0));

  // 잊을 위험이 큰 복습이 먼저 자리를 차지하고, 남는 자리에만 신규를 들인다.
  const room = Math.max(0, reviewLimit - totalDone);
  const picked = byRisk.slice(0, room);
  const newRoom = Math.min(Math.max(0, newLimit - newDone), room - picked.length);
  return [...picked, ...byAge.slice(0, newRoom)];
}

/** 지금 due인 항목 수 (상한과 무관한 전체). "대기 중"을 세는 데 쓴다. */
export function countDue(items, now) {
  return items.filter((it) => it.raw.due <= now).length;
}
