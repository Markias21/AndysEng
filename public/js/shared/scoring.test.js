import { test } from "node:test";
import assert from "node:assert/strict";
import { pointsForGrade, overallGrade, scoreDetail, RUBRICS } from "./scoring.js";

test("pointsForGrade: 등급을 만점 비율로 환산", () => {
  assert.equal(pointsForGrade("S", 50), 50); // ×1.0
  assert.equal(pointsForGrade("A", 50), 40); // ×0.8
  assert.equal(pointsForGrade("B", 50), 30); // ×0.6
  assert.equal(pointsForGrade("C", 50), 20); // ×0.4
  assert.equal(pointsForGrade("F", 50), 10); // ×0.2
});

test("pointsForGrade: 만점이 다르면 비율대로", () => {
  assert.equal(pointsForGrade("A", 40), 32); // 문법성(회화) A
  assert.equal(pointsForGrade("A", 30), 24);
  assert.equal(pointsForGrade("B", 30), 18);
});

test("pointsForGrade: 알 수 없는 등급은 F로", () => {
  assert.equal(pointsForGrade("X", 50), 10);
  assert.equal(pointsForGrade(undefined, 50), 10);
});

test("각 기능의 배점 합은 100", () => {
  for (const key of Object.keys(RUBRICS)) {
    const sum = RUBRICS[key].components.reduce((s, c) => s + c.max, 0);
    assert.equal(sum, 100, `${key} 배점 합`);
  }
});

test("overallGrade: 총점 비율 → 종합 등급 (0.2 간격 중간값 경계)", () => {
  assert.equal(overallGrade(1.0), "S");
  assert.equal(overallGrade(0.9), "S");
  assert.equal(overallGrade(0.8), "A"); // 전부 A(=0.8)면 종합도 A
  assert.equal(overallGrade(0.7), "A");
  assert.equal(overallGrade(0.6), "B"); // 전부 B
  assert.equal(overallGrade(0.5), "B");
  assert.equal(overallGrade(0.4), "C"); // 전부 C
  assert.equal(overallGrade(0.3), "C");
  assert.equal(overallGrade(0.2), "F"); // 전부 F
});

test("overallGrade: 비정상 값은 F", () => {
  assert.equal(overallGrade(NaN), "F");
  assert.equal(overallGrade(-1), "F");
});

test("scoreDetail: 표현 자연스러움 A → 40점 (만점 50)", () => {
  const d = scoreDetail("expression", { naturalness: "A", grammar: "S", comprehension: "B" });
  const nat = d.components.find((c) => c.key === "naturalness");
  assert.equal(nat.points, 40);
  assert.equal(nat.grade, "A");
  assert.equal(d.components.find((c) => c.key === "grammar").points, 30); // S×30
  assert.equal(d.components.find((c) => c.key === "comprehension").points, 12); // B×20=0.6×20
  assert.equal(d.total, 82);
  assert.equal(d.maxTotal, 100);
  assert.equal(d.overall, "A"); // 0.82 → A
});

test("scoreDetail: 전부 S면 만점·종합 S", () => {
  const d = scoreDetail("conversation", { naturalness: "S", grammar: "S", structure: "S" });
  assert.equal(d.total, 100);
  assert.equal(d.overall, "S");
});

test("scoreDetail: 누락된 등급은 F 취급", () => {
  const d = scoreDetail("expression", { naturalness: "S" });
  assert.equal(d.components.find((c) => c.key === "grammar").grade, "F");
  assert.equal(d.components.find((c) => c.key === "grammar").points, 6); // 30×0.2
});

test("scoreDetail: 알 수 없는 기능은 에러", () => {
  assert.throws(() => scoreDetail("quiz", {}));
});
