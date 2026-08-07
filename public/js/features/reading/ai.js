// 리딩의 AI 호출. 두 가지뿐이고, 둘 다 토큰을 아끼도록 좁혀 놨다.
//
//  1) 문제 세트 생성 — 지문당 평생 1회(전체 유저 공용). 결과를 store에 영구 캐시하므로 재도전은 0회다.
//     객관식 정답 키를 함께 받아 두기 때문에 객관식·빈칸 채점에는 AI가 아예 관여하지 않는다.
//     비용이 실제로 드는 유일한 지점이라 readySet()/generateSet()으로 나눠 뒀다 — UI가 그
//     사이에서 예상 비용을 보여 주고 확인을 받은 뒤에만 generateSet()을 부른다.
//  2) 요약·재진술 채점 — 지문 대신 (1)에서 받아 둔 main_idea·key_points만 보낸다.
//     둘 다 비우고 제출하면 호출 자체를 하지 않는다(ui.js가 판단).
//
// 생성 결과는 Supabase의 공용 캐시 테이블(shared_sets)에 올라가 다음 유저부터는 AI 호출 없이
// 그대로 재사용된다(supabase/schema.sql — 읽기는 공개, 쓰기는 INSERT만 허용해 한 번 채워진 값은
// 아무도 못 고친다). 예전에는 "레포에 자동 커밋해 공유"를 검토했다가 공유 GitHub 토큰이 앱
// 소스 레포 전체에 쓰기 권한을 갖게 되는 문제로 기각했는데(2026-08-02 ADR), RLS는 경로가 아니라
// 테이블 단위로 권한을 나눌 수 있어 그 문제 없이 같은 목표(공유)를 이룬다. GitHub Actions는
// 여전히 지문 수집만 하고(AI 미사용), 미리 채워 두고 싶으면 scripts/gen-reading-sets.js를
// 사람이 손으로 돌린다.
import { chatJSON, getModel } from "../../shared/claude.js";
import { getReadingSet, setReadingSet } from "../../shared/store.js";
import { getShared, putShared } from "../../shared/supabase.js";
import { estimateUsd } from "../../shared/usage.js";
import { loadShippedSet } from "./catalog.js";
import { GENERATE_SCHEMA, GRADE_SCHEMA } from "./schema.js";
import { generateSystem, gradeSystem } from "./prompts.js";
import { bodyText, resolveBlanks } from "./passage.js";
import { validQuestions } from "./score.js";

// 실측(헤드리스 브라우저로 실제 호출) 기준 문제 생성 1회의 출력 토큰은 대략 이 정도였다.
// 사전 비용 안내는 정확한 청구액이 아니라 어림값이다 — 실제 토큰 수는 지문 길이·모델 사고
// 분량에 따라 달라지고, 실제 청구액은 매번 usage.costUsd로 사후 집계된다.
const EST_OUTPUT_TOKENS = 2000;

/**
 * 이미 확보된 문제 세트가 있으면 그것을 반환하고, AI는 호출하지 않는다. 순서: ① 이 유저가
 * 이미 생성해 둔 것(store.readingSets) ② 레포에 미리 실어 둔 기본 세트(public/data/reading/sets/,
 * same-origin fetch만 함) ③ 다른 유저가 이미 만들어 Supabase 공용 캐시에 올려 둔 것.
 * ②·③을 찾아도 유저 캐시에는 복사하지 않는다 — ②는 서비스 워커가, ③은 공용 캐시 자체가
 * 이미 같은 역할을 하므로 localStorage 페이로드를 불릴 이유가 없다.
 * 셋 다 없으면 null — 이 경우 estimatedCost()로 비용을 안내하고 확인받은 뒤 generateSet()을 불러야 한다.
 */
export async function readySet(article) {
  const cached = getReadingSet(article.id);
  if (cached) return withSentences(article, cached);

  const shipped = await loadShippedSet(article.id);
  if (shipped) return withSentences(article, shipped);

  const shared = await getShared("reading", article.id);
  if (shared) return withSentences(article, shared);

  return null;
}

/** 이 지문의 문제를 지금 새로 생성한다면 드는 비용의 대략적인 추정치(달러). */
export function estimatedCost(article, level) {
  const promptChars = generateSystem(level).length + article.title.length + bodyText(article).length;
  return estimateUsd(getModel(), { promptChars, estOutputTokens: EST_OUTPUT_TOKENS });
}

/** 실제로 AI를 호출해 문제를 생성하고 유저 캐시에 저장한다. 비용이 드는 유일한 지점. */
export async function generateSet(article, level) {
  const set = await chatJSON({
    system: generateSystem(level),
    messages: [{ role: "user", content: `Title: ${article.title}\n\n${bodyText(article)}` }],
    schema: GENERATE_SCHEMA,
    maxTokens: 4096,
  });
  setReadingSet(article.id, set);
  putShared("reading", article.id, set);
  return withSentences(article, set);
}

/**
 * 캐시에는 AI가 준 그대로 두고, 화면에 줄 때만 손질한다.
 * - blanks: 지문 속 예문을 되찾아 붙인다(지문이 있어야 찾을 수 있다).
 * - questions: 4지선다·정답 인덱스가 성립하는 것만 남긴다(score.validQuestions).
 */
function withSentences(article, set) {
  return { ...set, questions: validQuestions(set.questions), blanks: resolveBlanks(article, set.blanks) };
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
