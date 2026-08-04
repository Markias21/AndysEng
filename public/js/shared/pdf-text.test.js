import test from "node:test";
import assert from "node:assert/strict";
import { decodeMacRoman, pdfPages, runsToLines, textRuns } from "./pdf-text.js";

test("decodeMacRoman은 0x80~0xFF를 한 칸도 밀리지 않게 옮긴다", () => {
  const at = (code) => decodeMacRoman(String.fromCharCode(code));
  assert.equal(at(0xc9), "…");
  assert.equal(at(0xca), " "); // 비분리 공백 — 빠뜨리기 쉬운 자리
  assert.equal(at(0xd0), "–");
  assert.equal(at(0xd1), "—");
  assert.equal(at(0xd5), "’");
  assert.equal(at(0xff), "ˇ");
  // 표 전체가 128자여야 뒤쪽이 밀리지 않는다.
  let mapped = "";
  for (let code = 0x80; code <= 0xff; code += 1) mapped += at(code);
  assert.equal([...mapped].length, 128);
  assert.equal(decodeMacRoman("plain ASCII"), "plain ASCII");
});

test("textRuns는 cm·Tm을 곱해 조각의 위치를 잡는다", () => {
  const runs = textRuns("q 0.24 0 0 0.24 0 640.08 cm BT 83 0 0 83 300 509 Tm [(A) 2 (B)] TJ ET Q");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, "AB"); // 커닝 숫자는 글자를 쪼개지 않는다
  assert.ok(Math.abs(runs[0].x - 72) < 0.01);
  assert.ok(Math.abs(runs[0].y - 762.24) < 0.01);
});

test("textRuns는 문자열 이스케이프와 8진수를 푼다", () => {
  const runs = textRuns("BT 1 0 0 1 0 700 Tm (\\(informal\\) caf\\216) Tj ET");
  assert.equal(runs[0].text, "(informal) café"); // \216 = 0x8E = MacRoman é
});

test("runsToLines는 같은 높이의 조각을 한 줄로 잇는다", () => {
  // 커닝 때문에 한 단어가 여러 조각으로 쪼개져 나오는 실제 상황.
  const lines = runsToLines([
    { x: 30, y: 700, text: "for" },
    { x: 10, y: 700, text: "word-" },
    { x: 10, y: 686, text: "transcript" },
  ]);
  assert.deepEqual(lines, ["word-for", "transcript"]);
});

test("runsToLines는 줄 간격이 벌어지면 문단 경계로 보고 빈 줄을 끼운다", () => {
  const lines = runsToLines([
    { x: 10, y: 700, text: "Neil" },
    { x: 10, y: 686, text: "Hello there." },
    { x: 10, y: 640, text: "Pippa" }, // 평소 간격(14)보다 훨씬 벌어짐
  ]);
  assert.deepEqual(lines, ["Neil", "Hello there.", "", "Pippa"]);
});

/** 압축하지 않은 최소 PDF. 실제 BBC PDF를 테스트에 커밋하지 않기 위해 직접 만든다(저작물). */
function tinyPdf(content) {
  return new TextEncoder().encode(
    `%PDF-1.3\n1 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`
  ).buffer;
}

test("pdfPages는 PDF 바이트에서 페이지별 줄을 뽑는다", async () => {
  const pages = await pdfPages(
    tinyPdf("BT 1 0 0 1 72 700 Tm (Neil) Tj ET BT 1 0 0 1 72 686 Tm (Hello, this is 6 Minute English.) Tj ET")
  );
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0].lines, ["Neil", "Hello, this is 6 Minute English."]);
});

test("pdfPages는 글자를 못 찾으면 조용히 빈 결과를 주지 않고 던진다", async () => {
  await assert.rejects(() => pdfPages(new TextEncoder().encode("%PDF-1.3\nno streams here\n").buffer), /글자를 찾지 못했습니다/);
});
