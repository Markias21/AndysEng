import test from "node:test";
import assert from "node:assert/strict";
import { parseTranscript, wordsIn } from "./transcript.js";
import { buildSegments, formatClock, startSecOf } from "./segments.js";

// 실제 대본 PDF에서 나오는 줄 구조를 그대로 흉내 낸 것(문장은 직접 지어냈다 — BBC 대본은 저작물이라
// 레포에 담지 않는다). 머리말·꼬리말, 심볼 폰트가 남긴 "!", 문단 경계 빈 줄이 섞여 있다.
const LINES = [
  "BBC LEARNING ENGLISH",
  "",
  "6 Minute English",
  "",
  "Talking to plants",
  "",
  "This is not a word-for-word transcript.",
  "!",
  "!",
  "Neil",
  "Hello, this is 6 Minute English. I'm Neil.",
  "",
  "Pippa",
  "And I'm Pippa. Today we are asking whether plants can hear us at all, and",
  "whether it makes any difference to how they grow.",
  "",
  "Dr Amy Green",
  "Plants respond to vibration, but that is not the same thing as hearing.",
  "!",
  "6 Minute English ©British Broadcasting Corporation 2026",
  "bbclearningenglish.com Page 2 of 5",
  "!",
  "Neil",
  "Goodbye!",
  "",
  "VOCABULARY",
  "",
  "vibration",
  "a small, fast movement backwards and forwards",
  "",
  "respond to something",
  "react to something that has happened",
];

test("parseTranscript는 화자별로 대사를 묶고 줄바꿈된 문장을 잇는다", () => {
  const { turns } = parseTranscript(LINES, "Talking to plants");
  assert.deepEqual(
    turns.map((t) => t.speaker),
    ["Neil", "Pippa", "Dr Amy Green", "Neil"]
  );
  assert.equal(
    turns[1].text,
    "And I'm Pippa. Today we are asking whether plants can hear us at all, and whether it makes any difference to how they grow."
  );
});

test("parseTranscript는 머리말·꼬리말·심볼 잔재·제목을 본문에서 지운다", () => {
  const { turns } = parseTranscript(LINES, "Talking to plants");
  const joined = turns.map((t) => `${t.speaker} ${t.text}`).join(" ");
  for (const junk of ["BBC LEARNING ENGLISH", "Broadcasting Corporation", "bbclearningenglish", "Page 2 of 5", "word-for-word"]) {
    assert.ok(!joined.includes(junk), `본문에 "${junk}"가 남았다`);
  }
  // 심볼 폰트가 남긴 "!"는 지우되, 진짜 느낌표("Goodbye!")는 살아 있어야 한다.
  assert.ok(!turns.some((t) => /^[!\s]+$/.test(t.text)));
  assert.equal(turns[3].text, "Goodbye!");
  // 제목이 화자 이름처럼 보여도(짧고 마침표 없음) 턴이 되면 안 된다.
  assert.ok(!turns.some((t) => t.speaker === "Talking to plants"));
});

test("parseTranscript는 VOCABULARY 아래를 용어와 정의로 나눈다", () => {
  const { vocabulary } = parseTranscript(LINES, "Talking to plants");
  assert.deepEqual(vocabulary, [
    { word: "vibration", definition: "a small, fast movement backwards and forwards" },
    { word: "respond to something", definition: "react to something that has happened" },
  ]);
});

test("parseTranscript는 어휘 섹션이 없어도 본문을 돌려준다", () => {
  const { turns, vocabulary } = parseTranscript(["Neil", "Hello there."], "");
  assert.equal(turns.length, 1);
  assert.deepEqual(vocabulary, []);
});

test("words는 대사 단어만 센다 (화자 이름·어휘 제외)", () => {
  const { turns, words } = parseTranscript(LINES, "Talking to plants");
  assert.equal(words, turns.reduce((n, t) => n + wordsIn(t.text), 0));
});

test("buildSegments는 목표 분량을 넘을 때까지 턴을 모은다", () => {
  const turns = Array.from({ length: 6 }, (_, i) => ({ speaker: `S${i}`, text: "one two three four five" }));
  const segments = buildSegments(turns, 10);
  assert.equal(segments.length, 3);
  assert.deepEqual(
    segments.map((s) => s.words),
    [10, 10, 10]
  );
  assert.deepEqual(
    segments.map((s) => s.startWord),
    [0, 10, 20]
  );
});

test("buildSegments는 마지막 자투리를 앞 구간에 붙인다", () => {
  const turns = Array.from({ length: 5 }, () => ({ speaker: "S", text: "one two three four five" }));
  const segments = buildSegments(turns, 10);
  assert.equal(segments.length, 2);
  assert.deepEqual(
    segments.map((s) => s.words),
    [10, 15]
  );
});

test("startSecOf는 단어 위치를 오디오 길이에 비례시킨다", () => {
  const segment = { startWord: 250 };
  assert.equal(startSecOf(segment, 1000, 360), 90);
  // 오디오 메타데이터가 아직 없으면 처음부터 재생한다.
  assert.equal(startSecOf(segment, 1000, 0), 0);
  assert.equal(startSecOf(segment, 0, 360), 0);
});

test("formatClock은 mm:ss로 보여 주고 음수를 0으로 막는다", () => {
  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(95.7), "01:35");
  assert.equal(formatClock(-3), "00:00");
});
