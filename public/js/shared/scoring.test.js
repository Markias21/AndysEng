import { test } from "node:test";
import assert from "node:assert/strict";
import { pointsForGrade, overallGrade, scoreDetail, gradeClass, RUBRICS, GRADES } from "./scoring.js";

test("pointsForGrade: 9단계 등급을 만점 비율로 환산 (0.1 간격)", () => {
  assert.equal(pointsForGrade("S+", 50), 50); // ×1.0
  assert.equal(pointsForGrade("S", 50), 45); // ×0.9
  assert.equal(pointsForGrade("A+", 50), 40); // ×0.8
  assert.equal(pointsForGrade("A", 50), 35); // ×0.7
  assert.equal(pointsForGrade("B+", 50), 30); // ×0.6
  assert.equal(pointsForGrade("B", 50), 25); // ×0.5
  assert.equal(pointsForGrade("C+", 50), 20); // ×0.4
  assert.equal(pointsForGrade("C", 50), 15); // ×0.3
  assert.equal(pointsForGrade("F", 50), 10); // ×0.2
});

test("pointsForGrade: 만점이 다르면 비율대로", () => {
  assert.equal(pointsForGrade("A+", 25), 20); // 0.8×25
  assert.equal(pointsForGrade("A", 30), 21); // 0.7×30
  assert.equal(pointsForGrade("B", 30), 15); // 0.5×30
});

test("pointsForGrade: 알 수 없는 등급은 F로", () => {
  assert.equal(pointsForGrade("X", 50), 10);
  assert.equal(pointsForGrade(undefined, 50), 10);
});

test("GRADES는 9단계(S+~F)", () => {
  assert.deepEqual(GRADES, ["S+", "S", "A+", "A", "B+", "B", "C+", "C", "F"]);
});

test("각 기능은 task/accuracy/range/fluency 4축이고 배점 합은 100", () => {
  const expectedKeys = ["task", "accuracy", "range", "fluency"];
  for (const key of Object.keys(RUBRICS)) {
    const comps = RUBRICS[key].components;
    assert.deepEqual(comps.map((c) => c.key), expectedKeys, `${key} 축`);
    assert.equal(comps.reduce((s, c) => s + c.max, 0), 100, `${key} 배점 합`);
  }
});

test("overallGrade: 총점 비율 → 종합 등급 (0.1 간격 중간값 경계)", () => {
  assert.equal(overallGrade(1.0), "S+");
  assert.equal(overallGrade(0.95), "S+");
  assert.equal(overallGrade(0.9), "S"); // 전부 S(=0.9)면 종합도 S
  assert.equal(overallGrade(0.85), "S");
  assert.equal(overallGrade(0.8), "A+"); // 전부 A+
  assert.equal(overallGrade(0.7), "A"); // 전부 A
  assert.equal(overallGrade(0.6), "B+"); // 전부 B+
  assert.equal(overallGrade(0.5), "B"); // 전부 B
  assert.equal(overallGrade(0.4), "C+"); // 전부 C+
  assert.equal(overallGrade(0.3), "C"); // 전부 C
  assert.equal(overallGrade(0.2), "F"); // 전부 F
});

test("overallGrade: 비정상 값은 F", () => {
  assert.equal(overallGrade(NaN), "F");
  assert.equal(overallGrade(-1), "F");
});

test("gradeClass: '+'를 안전한 클래스 접미사로", () => {
  assert.equal(gradeClass("S+"), "grade-Splus");
  assert.equal(gradeClass("A"), "grade-A");
  assert.equal(gradeClass("F"), "grade-F");
});

test("scoreDetail: 회화 4축 혼합 등급 → 요소 점수·총점·종합", () => {
  // task A+(25→20) · accuracy S(25→22.5→23) · range B(20→10) · fluency A(30→21)
  const d = scoreDetail("conversation", { task: "A+", accuracy: "S", range: "B", fluency: "A" });
  assert.equal(d.components.find((c) => c.key === "task").points, 20);
  assert.equal(d.components.find((c) => c.key === "accuracy").points, 23); // 0.9×25=22.5→23
  assert.equal(d.components.find((c) => c.key === "range").points, 10); // 0.5×20
  assert.equal(d.components.find((c) => c.key === "fluency").points, 21); // 0.7×30
  assert.equal(d.total, 74);
  assert.equal(d.maxTotal, 100);
  assert.equal(d.overall, "A"); // 0.74 → A
});

test("scoreDetail: 전부 S+면 만점·종합 S+", () => {
  const d = scoreDetail("writing", { task: "S+", accuracy: "S+", range: "S+", fluency: "S+" });
  assert.equal(d.total, 100);
  assert.equal(d.overall, "S+");
});

test("scoreDetail: 누락된 등급은 F 취급 (구버전 기록 하위호환)", () => {
  const d = scoreDetail("expression", { task: "S+" });
  assert.equal(d.components.find((c) => c.key === "accuracy").grade, "F");
  assert.equal(d.components.find((c) => c.key === "accuracy").points, 5); // 25×0.2
});

test("scoreDetail: 알 수 없는 기능은 에러", () => {
  assert.throws(() => scoreDetail("quiz", {}));
});
