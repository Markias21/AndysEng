// 저장소의 표현 카드(deck)와 단어 카드(words)를 복습 화면이 쓰는 한 가지 모양으로 바꾸고,
// 오늘의 계획(상한 적용된 큐 + 진행 상황)을 계산한다. 도메인 계산은 session.js가 맡는다.
import { buildSession, todaysCounts, countDue } from "./session.js";
import { getDeck, getWords, getRecords, getProfile } from "../../shared/store.js";
import { filterByLevel } from "../../shared/levels.js";
import { toSeoulDate } from "../../shared/date.js";

/** 표현 카드/단어 카드를 복습 화면에서 공통으로 다루기 위한 어댑터. */
export function wrap(raw, kind) {
  return {
    kind,
    raw,
    term: kind === "word" ? raw.word : raw.expression,
    meaning: raw.meaning,
    example: raw.example,
    exampleKo: raw.exampleKo,
    pos: raw.pos,
    level: raw.level,
    nonLiteral: raw.nonLiteral,
  };
}

/** 쌓인 전체 항목 (목록 표시용, 레벨 필터 없음). */
export function allItems() {
  return [...getDeck().map((c) => wrap(c, "expression")), ...getWords().map((w) => wrap(w, "word"))];
}

/** 레벨 필터를 통과한 학습 대상 전체. 단어 카드는 레벨 태그가 없어 항상 포함된다. */
function studyItems(level) {
  const expr = filterByLevel(getDeck(), level, 1).map((c) => wrap(c, "expression"));
  const words = getWords().map((w) => wrap(w, "word"));
  return [...expr, ...words];
}

/** 오늘의 큐와 진행 상황. 홈 화면과 세션 시작이 같은 계산을 쓴다. */
export function todayPlan() {
  const { level, dailyNewLimit: newLimit, dailyReviewLimit: reviewLimit } = getProfile();
  const now = Date.now();
  const items = studyItems(level);
  const { totalDone, newDone } = todaysCounts(getRecords("quiz"), toSeoulDate(new Date().toISOString()));
  const plan = buildSession(items, { now, newLimit, reviewLimit, newDone, totalDone });
  return { plan, totalDone, newDone, newLimit, reviewLimit, waiting: countDue(items, now) - plan.length };
}
