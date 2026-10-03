// 다시 쓰기 대기열. 순수 함수만 — UI·저장소를 import하지 않는다.
//
// 첨삭이 끝나면 같은 질문(+3일)과 자매 질문(+8일) 두 건을 예약한다. 며칠 뒤 **지난 첨삭을 숨긴 채**
// 다시 쓰게 하고, 모았던 표현을 실제로 꺼내 썼는지 로컬에서 판정한다(AI 0원).
//
// 왜 두 건인가: 같은 질문은 "그 표현을 쓸 수 있는가"를, 자매 질문은 "다른 맥락으로 옮길 수 있는가"를 본다.
// ETS가 외운 문장을 주제에 끼워 맞추는 답안을 경고하므로, 같은 질문 반복만으로는 암기로 변질될 수 있다.
import { variantsOf } from "../../shared/inflect.js";
import { addDays } from "../../shared/date.js";

export const SAME_DELAY_DAYS = 3;
export const SISTER_DELAY_DAYS = 8;

// 하루에 받을 다시 쓰기 수. 넘친 건 사라지지 않고 다음 날로 밀린다(복습의 하루 상한과 같은 방식).
export const DAILY_REWRITE_LIMIT = 5;

const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const WORDISH = /[\p{L}\p{N}]/u;

/** 단어 경계를 지키는 부분 문자열 검색. "in"이 "interesting" 안에서 잡히지 않게 한다. */
function containsPhrase(haystack, needle) {
  if (!needle) return false;
  for (let from = 0; ; ) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return false;
    const end = at + needle.length;
    const okBefore = at === 0 || !WORDISH.test(haystack[at - 1]);
    const okAfter = end >= haystack.length || !WORDISH.test(haystack[end]);
    if (okBefore && okAfter) return true;
    from = at + 1;
  }
}

/**
 * 다시 쓰기에서 "써 봐야 할 표현" 목록.
 * 원어민 표현(native_expressions)과 막힌 곳 해답(gap_solutions)을 **전부** 담는다.
 * 유저가 ➕로 덱에 담았는지는 여기 저장하지 않고 복습 덱을 보고 그때그때 판정한다(splitByPicked) —
 * ➕는 예약 이후에 눌리고, 나중에 복습 목록에서 빼기도 하기 때문이다.
 */
export function targetsOf(feedback) {
  const rows = [...(feedback?.native_expressions || []), ...(feedback?.gap_solutions || [])];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const expression = String(row?.expression ?? "").trim();
    if (!expression) continue;
    const key = expression.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ expression, meaning: String(row?.meaning ?? "").trim(), fromGap: Boolean(row?.ko) });
  }
  return out;
}

/**
 * 첨삭 하나에 대한 다시 쓰기 예약 2건. id는 저장소가 붙인다(addToDeck과 같은 방식).
 * record: records.writing의 항목(rid·mode·question·promptId·feedback). sisterPrompt: { text, promptId }.
 * 다시 쓰기에서 나온 글(rewriteOf가 있는 기록)은 새 예약을 만들지 않는다 — 연쇄 금지.
 */
export function scheduleRewrites(record, sisterPrompt, todayKey) {
  if (!record?.rid || record.rewriteOf) return [];
  const targets = targetsOf(record.feedback);
  if (targets.length === 0) return [];

  const base = { sourceRid: record.rid, mode: record.mode || "discussion", status: "pending", targets };
  const out = [
    { ...base, stage: "same", prompt: record.question, promptId: record.promptId || null, due: addDays(todayKey, SAME_DELAY_DAYS) },
  ];
  if (sisterPrompt?.text) {
    out.push({
      ...base,
      stage: "sister",
      prompt: sisterPrompt.text,
      promptId: sisterPrompt.promptId || null,
      due: addDays(todayKey, SISTER_DELAY_DAYS),
    });
  }
  return out;
}

const STAGE_ORDER = { same: 0, sister: 1 };

/**
 * 오늘 할 다시 쓰기. 가장 오래 밀린 것부터, 하루 상한까지.
 * → { today: [...], overflow: 넘쳐서 내일로 밀린 개수 }
 */
export function dueRewrites(rewrites, todayKey, limit = DAILY_REWRITE_LIMIT) {
  const due = (rewrites || [])
    .filter((r) => r?.status === "pending" && r.due && r.due <= todayKey)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9)));
  const cap = Math.max(0, limit);
  return { today: due.slice(0, cap), overflow: Math.max(0, due.length - cap) };
}

/** 각 표현을 이번 글에서 실제로 썼는지. 굴절형(pay off → pays off)까지 본다. */
export function usedTargets(text, targets) {
  const hay = norm(text);
  return (targets || []).map((t) => ({
    ...t,
    used: variantsOf(norm(t.expression)).some((form) => containsPhrase(hay, form)),
  }));
}

/** 복습 덱에 담은 표현을 앞으로, 나머지를 뒤로. deckKeys는 소문자 표현의 Set. */
export function splitByPicked(targets, deckKeys) {
  const keys = deckKeys instanceof Set ? deckKeys : new Set(deckKeys || []);
  const picked = [];
  const rest = [];
  for (const t of targets || []) (keys.has(t.expression.toLowerCase()) ? picked : rest).push({ ...t, picked: keys.has(t.expression.toLowerCase()) });
  return { picked, rest };
}
