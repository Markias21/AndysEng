// 점수 시스템 도메인 로직. 순수 함수만 — UI/저장소를 import하지 않는다.
//
// AI는 배점 요소마다 S/A/B/C/F 등급만 매긴다(토큰 절약: 숫자 대신 글자 하나).
// 점수는 여기서 산출한다: 등급을 그 요소 "만점"에 대한 비율로 환산한다.
//   S = 만점 × 1.0, A = ×0.8, B = ×0.6, C = ×0.4, F = ×0.2 (1/5 간격)
// 예) 표현의 '자연스러움' 비중이 50점이고 등급이 A면 → 50 × 0.8 = 40점.
// 각 기능의 요소 배점 합은 100점이라 총점은 0~100으로 유지된다(기존 통계/평균과 호환).

export const RUBRICS = {
  conversation: {
    label: "회화",
    components: [
      { key: "naturalness", label: "자연스러움", max: 30 },
      { key: "grammar", label: "문법성", max: 40 },
      { key: "structure", label: "문장 구조·이해 난이도", max: 30 },
    ],
  },
  writing: {
    label: "글쓰기",
    components: [
      { key: "essay_structure", label: "글의 구조", max: 20 },
      { key: "grammar", label: "문법성", max: 30 },
      { key: "comprehension", label: "문장 구조·이해", max: 30 },
      { key: "modifier_naturalness", label: "수식어·표현의 자연스러움", max: 20 },
    ],
  },
  expression: {
    label: "표현",
    components: [
      { key: "naturalness", label: "표현의 자연스러움", max: 50 },
      { key: "grammar", label: "문법성", max: 30 },
      { key: "comprehension", label: "문장 구조·이해", max: 20 },
    ],
  },
};

export const GRADES = ["S", "A", "B", "C", "F"];

// 등급 → 만점 대비 비율 (1/5 간격).
export const GRADE_RATIO = { S: 1.0, A: 0.8, B: 0.6, C: 0.4, F: 0.2 };

/** 등급과 요소 만점으로 획득 점수(반올림). 알 수 없는 등급은 F로 본다. */
export function pointsForGrade(grade, max) {
  const ratio = GRADE_RATIO[grade] ?? GRADE_RATIO.F;
  return Math.round(max * ratio);
}

// 총점 비율 → 종합 등급. 각 등급 비율(0.2 간격)의 중간값을 경계로 삼는다.
export const OVERALL_THRESHOLDS = [
  [0.9, "S"],
  [0.7, "A"],
  [0.5, "B"],
  [0.3, "C"],
];

/** 총점 비율(0~1)을 종합 등급으로. 비정상 값은 F. */
export function overallGrade(ratio) {
  if (!Number.isFinite(ratio) || ratio < 0) return "F";
  for (const [threshold, grade] of OVERALL_THRESHOLDS) {
    if (ratio >= threshold) return grade;
  }
  return "F";
}

/**
 * 기능(feature)과 요소별 등급(grades)으로 요소 점수·총점·종합 등급을 산출한다.
 * grades: { [componentKey]: "S"|"A"|"B"|"C"|"F" }
 * 반환: { feature, label, total, maxTotal, overall, components: [{key,label,grade,points,max}] }
 */
export function scoreDetail(feature, grades) {
  const rubric = RUBRICS[feature];
  if (!rubric) throw new Error(`알 수 없는 기능: ${feature}`);
  const components = rubric.components.map((c) => {
    const grade = GRADE_RATIO[grades?.[c.key]] !== undefined ? grades[c.key] : "F";
    return { key: c.key, label: c.label, grade, points: pointsForGrade(grade, c.max), max: c.max };
  });
  const total = components.reduce((sum, c) => sum + c.points, 0);
  const maxTotal = rubric.components.reduce((sum, c) => sum + c.max, 0);
  return {
    feature,
    label: rubric.label,
    total,
    maxTotal,
    overall: overallGrade(maxTotal > 0 ? total / maxTotal : 0),
    components,
  };
}
