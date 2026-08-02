// 리딩의 AI 호출. 두 가지뿐이고, 둘 다 토큰을 아끼도록 좁혀 놨다.
//
//  1) 문제 세트 생성 — 지문당 평생 1회. 결과를 store에 영구 캐시하므로 재도전은 0회다.
//     객관식 정답 키를 함께 받아 두기 때문에 객관식·빈칸 채점에는 AI가 아예 관여하지 않는다.
//  2) 요약·재진술 채점 — 지문 대신 (1)에서 받아 둔 main_idea·key_points만 보낸다.
//     둘 다 비우고 제출하면 호출 자체를 하지 않는다(ui.js가 판단).
import { chatJSON } from "../../shared/claude.js";
import { getReadingSet, setReadingSet } from "../../shared/store.js";
import { GENERATE_SCHEMA, GRADE_SCHEMA } from "./schema.js";
import { generateSystem, gradeSystem } from "./prompts.js";
import { bodyText, resolveBlanks } from "./passage.js";

/**
 * 이 지문의 문제 세트. 캐시에 있으면 그대로 쓰고, 없을 때만 생성한다.
 * 반환한 세트의 blanks에는 지문에서 되찾은 영어 예문(sentence)이 붙어 있다.
 */
export async function questionSet(article, level) {
  const cached = getReadingSet(article.id);
  if (cached) return withSentences(article, cached);

  const set = await chatJSON({
    system: generateSystem(level),
    messages: [{ role: "user", content: `Title: ${article.title}\n\n${bodyText(article)}` }],
    schema: GENERATE_SCHEMA,
    maxTokens: 4096,
  });
  setReadingSet(article.id, set);
  return withSentences(article, set);
}

/**
 * 캐시에는 AI가 준 그대로 두고, 화면에 줄 때만 손질한다.
 * - blanks: 지문 속 예문을 되찾아 붙인다(지문이 있어야 찾을 수 있다).
 * - questions: 4지선다·정답 인덱스가 성립하는 것만 남긴다. 구조화 출력 스키마가 배열 길이와
 *   정수 범위를 강제하지 못해(minItems>1·minimum 미지원), 그 검증을 여기서 대신한다.
 */
function withSentences(article, set) {
  const questions = (set.questions || []).filter(
    (q) => Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3
  );
  return { ...set, questions, blanks: resolveBlanks(article, set.blanks) };
}

/** 요약·재진술 채점. 지문은 보내지 않는다 — 체크리스트(key_points)만으로 채점하게 설계했다. */
export function gradeProduction({ set, level, summary, restatement }) {
  const parts = [
    summary ? `Summary:\n${summary}` : "Summary: (skipped)",
    restatement ? `Restatement:\n${restatement}` : "Restatement: (skipped)",
  ];
  return chatJSON({
    system: gradeSystem({
      level,
      mainIdea: set.main_idea,
      keyPoints: set.key_points,
      restateSentence: set.restate_sentence,
      summarySkipped: !summary,
      restateSkipped: !restatement,
    }),
    messages: [{ role: "user", content: parts.join("\n\n") }],
    schema: GRADE_SCHEMA,
    maxTokens: 2048,
  });
}
