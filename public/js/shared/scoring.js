// 점수 시스템 도메인 로직. 순수 함수만 — UI/저장소를 import하지 않는다.
//
// AI는 배점 요소마다 9단계 등급(S+~F)만 매긴다(토큰 절약: 숫자 대신 짧은 등급).
// 점수는 여기서 산출한다: 등급을 그 요소 "만점"에 대한 비율로 환산한다.
//   S+ 1.0 · S 0.9 · A+ 0.8 · A 0.7 · B+ 0.6 · B 0.5 · C+ 0.4 · C 0.3 · F 0.2 (0.1 간격)
// 예) 어떤 요소의 비중이 30점이고 등급이 A면 → 30 × 0.7 = 21점.
// 각 기능의 요소 배점 합은 100점이라 총점은 20~100으로 유지된다(F가 0.2 바닥, 기존 통계/평균과 호환).
//
// 채점 기준은 회화·글쓰기·복습이 CEFR/IELTS식 4대 분석 축을 공유하고 배점만 기능별로 다르다:
//   task(내용·과제 수행) · accuracy(정확성) · range(표현 범위) · fluency(유창성·자연스러움).
// 이 축들은 서로 독립적으로 움직이도록 설계됐다(정확하지만 단순한 글 = accuracy↑·range↓ 등).

export const RUBRICS = {
  conversation: {
    label: "회화",
    components: [
      { key: "task", label: "내용·상황 대응", max: 25 },
      { key: "accuracy", label: "정확성(문법)", max: 25 },
      { key: "range", label: "표현 범위", max: 20 },
      { key: "fluency", label: "유창성·자연스러움", max: 30 },
    ],
  },
  writing: {
    label: "글쓰기",
    components: [
      { key: "task", label: "내용·과제 수행", max: 30 },
      { key: "accuracy", label: "정확성(문법)", max: 25 },
      { key: "range", label: "표현 범위", max: 20 },
      { key: "fluency", label: "유창성·응집성", max: 25 },
    ],
  },
  expression: {
    label: "표현",
    components: [
      { key: "task", label: "표현 적확성", max: 35 },
      { key: "accuracy", label: "정확성(문법)", max: 25 },
      { key: "range", label: "표현 범위", max: 15 },
      { key: "fluency", label: "유창성·자연스러움", max: 25 },
    ],
  },
};

// AI 채점 시스템 프롬프트에 넣는 공통 지침(회화·글쓰기·표현 세 기능 공유, 드리프트 방지).
// 오타·대소문자·아포스트로피는 spelling으로 분리해 점수에서 빼고, 구어체/문어체는 문법으로 보지 않으며,
// 기초 구조 문법만 accuracy 등급에 반영한다.
export const GRAMMAR_RUBRIC = `Grammar grading rules (apply to the accuracy grade and to corrections):
- Never treat typos, capitalization, or apostrophe slips (e.g. its/it's, dont, i) as grammar errors. Put them only in the separate "spelling" list and never let them affect the accuracy grade or the corrections.
- Do not judge register (spoken/casual vs. written/formal English) as grammar.
- Judge accuracy only on core structural correctness: number of verbs in a clause, adjective vs. adverb confusion, subject-verb agreement, verb tense, articles (a/the), prepositions, plural forms, and word order.`;

// fluency(유창성·자연스러움) 채점에서 구어체/문어체(register)가 상황에 맞는지를 문법이 아니라 여기서 본다.
export const NATURALNESS_NOTE = `Register (spoken/casual vs. written/formal English) is judged as part of fluency, not accuracy: reward language whose register fits this situation, and treat a register that does not fit as less natural.`;

// task(내용·과제 수행) 절대 밴드. 형식이 아니라 내용·적절성으로만 본다.
export const TASK_RUBRIC = `Task grade (content and task fulfillment, judged on substance, not on language): how fully and relevantly the response addresses the prompt or situation and develops its ideas.
- Top (S+/S): directly and fully engages with it, with clear, relevant, well-developed ideas.
- Bottom (F): off-topic, empty, or with no real idea expressed.`;

// range(표현 범위) 절대 밴드. 이 축이 "실력이 늘면 숫자가 오른다"의 핵심 — 정확성과 독립적으로 야심을 잰다.
export const RANGE_RUBRIC = `Range grade (variety and sophistication of vocabulary and sentence structures), judged on an ABSOLUTE scale, never relative to the learner's level:
- Top (S+/S): a wide range of precise vocabulary and varied, complex sentence structures, used naturally.
- Bottom (F): only the most basic memorized words and short, formulaic simple sentences.
A simple but fully correct sentence should get a high accuracy grade and a LOW range grade — that is expected, not a contradiction.`;

// 9단계 등급 집합과 절대 채점 지시. 각 기능 프롬프트에 넣어 등급 스케일을 고정한다.
export const GRADE_SCALE_NOTE = `Grade each rubric component on this 9-level scale, from best to worst: S+, S, A+, A, B+, B, C+, C, F (S+ is flawless/native-like, F is very poor).
Grade every component against the SAME absolute bands regardless of the learner's stated level — do not grade more leniently just because a learner is a beginner. Real improvement must be able to raise the grades over time.`;

// 등급 순서(최상 → 최하). AI enum·검증에 쓴다.
export const GRADES = ["S+", "S", "A+", "A", "B+", "B", "C+", "C", "F"];

// 등급 → 만점 대비 비율 (0.1 간격, F는 0.2 바닥).
export const GRADE_RATIO = {
  "S+": 1.0,
  S: 0.9,
  "A+": 0.8,
  A: 0.7,
  "B+": 0.6,
  B: 0.5,
  "C+": 0.4,
  C: 0.3,
  F: 0.2,
};

// 등급 → CSS 클래스 안전 접미사(클래스명에 '+'를 못 쓴다). "S+" → "Splus".
export function gradeClass(grade) {
  return `grade-${String(grade).replace("+", "plus")}`;
}

/** 등급과 요소 만점으로 획득 점수(반올림). 알 수 없는 등급은 F로 본다. */
export function pointsForGrade(grade, max) {
  const ratio = GRADE_RATIO[grade] ?? GRADE_RATIO.F;
  return Math.round(max * ratio);
}

// 총점 비율 → 종합 등급. 인접 등급 비율(0.1 간격)의 중간값을 경계로 삼는다.
export const OVERALL_THRESHOLDS = [
  [0.95, "S+"],
  [0.85, "S"],
  [0.75, "A+"],
  [0.65, "A"],
  [0.55, "B+"],
  [0.45, "B"],
  [0.35, "C+"],
  [0.25, "C"],
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
 * grades: { [componentKey]: "S+"|"S"|...|"F" }
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
