import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_REWRITE_LIMIT, SAME_DELAY_DAYS, SISTER_DELAY_DAYS,
  dueRewrites, scheduleRewrites, splitByPicked, targetsOf, usedTargets,
} from "./rewrite.js";

const feedback = {
  native_expressions: [
    { expression: "pay off", meaning: "성과를 내다" },
    { expression: "a blessing in disguise", meaning: "전화위복" },
  ],
  gap_solutions: [{ ko: "~에 큰 영향을 미치다", expression: "have a profound impact on", meaning: "~에 큰 영향을 미치다" }],
};
const record = { rid: "r1", mode: "discussion", question: "Is remote work better?", feedback };

test("targetsOf: 원어민 표현과 막힌 곳 해답을 전부 담고 중복은 한 번만", () => {
  const targets = targetsOf(feedback);
  assert.deepEqual(targets.map((t) => t.expression), ["pay off", "a blessing in disguise", "have a profound impact on"]);
  assert.deepEqual(targets.map((t) => t.fromGap), [false, false, true], "막힌 곳에서 온 것은 표시해 둔다");

  const dup = targetsOf({ native_expressions: [{ expression: "Pay Off", meaning: "A" }], gap_solutions: [{ expression: "pay off", meaning: "B", ko: "성과" }] });
  assert.equal(dup.length, 1, "대소문자만 다른 중복은 합친다");
});

test("targetsOf: 비어 있거나 표현이 없는 항목은 건너뛴다", () => {
  assert.deepEqual(targetsOf({}), []);
  assert.deepEqual(targetsOf(undefined), []);
  assert.deepEqual(targetsOf({ native_expressions: [{ expression: "  " }, { meaning: "뜻만" }] }), []);
});

test("scheduleRewrites: 같은 질문 +3일, 자매 질문 +8일 두 건", () => {
  const out = scheduleRewrites(record, { text: "Should companies allow remote work?" }, "2026-10-05");

  assert.equal(out.length, 2);
  assert.equal(out[0].stage, "same");
  assert.equal(out[0].prompt, "Is remote work better?");
  assert.equal(out[0].due, "2026-10-08");
  assert.equal(out[1].stage, "sister");
  assert.equal(out[1].prompt, "Should companies allow remote work?");
  assert.equal(out[1].due, "2026-10-13");
  assert.equal(SAME_DELAY_DAYS, 3);
  assert.equal(SISTER_DELAY_DAYS, 8);
  for (const r of out) {
    assert.equal(r.sourceRid, "r1");
    assert.equal(r.status, "pending");
    assert.equal(r.targets.length, 3);
    assert.equal(r.id, undefined, "id는 저장소가 붙인다");
  }
});

test("scheduleRewrites: 월 경계를 넘어도 날짜가 맞는다", () => {
  const out = scheduleRewrites(record, { text: "sister" }, "2026-10-30");
  assert.equal(out[0].due, "2026-11-02");
  assert.equal(out[1].due, "2026-11-07");
});

test("scheduleRewrites: 다시 쓰기에서 나온 글은 새 예약을 만들지 않는다(연쇄 금지)", () => {
  assert.deepEqual(scheduleRewrites({ ...record, rewriteOf: "r0" }, { text: "sister" }, "2026-10-05"), []);
});

test("scheduleRewrites: rid 없는 옛 기록과 표현 없는 첨삭은 예약하지 않는다", () => {
  assert.deepEqual(scheduleRewrites({ ...record, rid: undefined }, { text: "s" }, "2026-10-05"), []);
  assert.deepEqual(scheduleRewrites({ ...record, feedback: {} }, { text: "s" }, "2026-10-05"), []);
});

test("scheduleRewrites: 자매 질문이 없으면 같은 질문 한 건만", () => {
  assert.equal(scheduleRewrites(record, null, "2026-10-05").length, 1);
  assert.equal(scheduleRewrites(record, { text: "" }, "2026-10-05").length, 1);
});

test("scheduleRewrites: 이메일은 promptId를 함께 들고 간다(수신자·요구 항목을 다시 그려야 한다)", () => {
  const email = { ...record, mode: "email", promptId: "req-3" };
  const out = scheduleRewrites(email, { text: "다른 상황", promptId: "req-7" }, "2026-10-05");
  assert.deepEqual(out.map((r) => [r.mode, r.promptId]), [["email", "req-3"], ["email", "req-7"]]);
});

const pending = (due, stage = "same") => ({ id: `${stage}-${due}`, status: "pending", due, stage });

test("dueRewrites: 오늘까지 밀린 것만, 오래된 것부터", () => {
  const rows = [pending("2026-10-09"), pending("2026-10-05"), pending("2026-10-07"), pending("2026-10-20")];
  const { today, overflow } = dueRewrites(rows, "2026-10-09", 10);
  assert.deepEqual(today.map((r) => r.due), ["2026-10-05", "2026-10-07", "2026-10-09"], "미래 예약은 빠진다");
  assert.equal(overflow, 0);
});

test("dueRewrites: 하루 상한을 넘기면 나머지는 넘침으로 센다(사라지지 않는다)", () => {
  const rows = Array.from({ length: 8 }, (_, i) => pending(`2026-10-0${i + 1}`));
  const { today, overflow } = dueRewrites(rows, "2026-10-09", 5);
  assert.equal(today.length, 5);
  assert.equal(overflow, 3);
  assert.deepEqual(today.map((r) => r.due), ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
  assert.equal(DAILY_REWRITE_LIMIT, 5, "기본 상한");
});

test("dueRewrites: 같은 날짜면 같은 질문을 자매 질문보다 먼저", () => {
  const rows = [pending("2026-10-05", "sister"), pending("2026-10-05", "same")];
  assert.deepEqual(dueRewrites(rows, "2026-10-05").today.map((r) => r.stage), ["same", "sister"]);
});

test("dueRewrites: 끝냈거나 건너뛴 것은 다시 나오지 않는다", () => {
  const rows = [
    { id: "a", status: "done", due: "2026-10-01" },
    { id: "b", status: "skipped", due: "2026-10-01" },
    pending("2026-10-01"),
  ];
  assert.deepEqual(dueRewrites(rows, "2026-10-09").today.map((r) => r.id), ["same-2026-10-01"]);
  assert.deepEqual(dueRewrites(undefined, "2026-10-09"), { today: [], overflow: 0 });
});

const targets = [
  { expression: "pay off", meaning: "성과를 내다" },
  { expression: "a blessing in disguise", meaning: "전화위복" },
  { expression: "in", meaning: "~ 안에" },
];

test("usedTargets: 굴절형으로 써도 썼다고 본다", () => {
  const out = usedTargets("All that effort finally pays off for me.", targets);
  assert.equal(out[0].used, true, "pay off → pays off");
  assert.equal(out[1].used, false);
});

test("usedTargets: 단어 경계를 지킨다", () => {
  // "in"이 "interesting" 안에서 잡히면 안 된다.
  assert.equal(usedTargets("This is an interesting point.", targets)[2].used, false);
  assert.equal(usedTargets("I live in Seoul.", targets)[2].used, true);
});

test("usedTargets: 대소문자·여분 공백·구두점에 흔들리지 않는다", () => {
  const out = usedTargets("It  was   A Blessing In Disguise, honestly.", targets);
  assert.equal(out[1].used, true);
});

test("usedTargets: 원래 항목을 보존하고 used만 더한다", () => {
  const out = usedTargets("", targets);
  assert.deepEqual(out.map((t) => t.meaning), ["성과를 내다", "전화위복", "~ 안에"]);
  assert.deepEqual(out.map((t) => t.used), [false, false, false]);
  assert.deepEqual(usedTargets("anything", undefined), []);
});

test("splitByPicked: 복습에 담은 표현을 앞으로 보낸다", () => {
  const { picked, rest } = splitByPicked(targets, new Set(["a blessing in disguise"]));
  assert.deepEqual(picked.map((t) => t.expression), ["a blessing in disguise"]);
  assert.deepEqual(rest.map((t) => t.expression), ["pay off", "in"]);
  assert.equal(picked[0].picked, true);
  assert.equal(rest[0].picked, false);

  const none = splitByPicked(targets, new Set());
  assert.equal(none.picked.length, 0);
  assert.equal(none.rest.length, 3, "하나도 안 담았어도 전부 보여 준다");
});
