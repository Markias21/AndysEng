// 리스닝의 AI 호출. 딱 하나뿐이다 — 이해 문제 세트 생성, 에피소드당 평생 1회(전체 유저 공용).
//
// 결과를 store에 영구 캐시하므로 재도전은 0회이고, 정답 키를 함께 받아 두기 때문에 채점에는
// AI가 아예 관여하지 않는다(shared/mcq.js). 대본·어휘·받아쓰기·구간 재생은 전부 AI를 쓰지 않는다.
//
// 비용이 드는 유일한 지점이라 readySet()/generateSet()으로 나눠 뒀다 — 화면이 그 사이에서
// 예상 비용을 보여 주고 확인을 받은 뒤에만 generateSet()을 부른다(리딩과 같은 방식).
// 생성 결과는 Supabase 공용 캐시(shared_sets)에도 올려 다음 유저부터는 AI 호출이 0회가 된다
// (리딩과 같은 이유 — features/reading/ai.js 상단 주석 참고).
import { chatJSON, getModel } from "../../shared/claude.js";
import { validQuestions } from "../../shared/mcq.js";
import { getSixMinSet, setSixMinSet } from "../../shared/store.js";
import { getShared, putShared } from "../../shared/supabase.js";
import { estimateUsd } from "../../shared/usage.js";
import { GENERATE_SCHEMA } from "./schema.js";
import { generateSystem } from "./prompts.js";

// 실측(헤드리스 브라우저로 실제 호출) 기준 문제 생성 1회는 $0.0315였다. 사전 안내가 실제보다
// 싸 보이면 안 되므로 출력 토큰을 넉넉히 잡아 추정이 위쪽으로 어긋나게 둔다.
// 정확한 청구액이 아니라 어림값이고, 실제 비용은 매번 usage.costUsd로 사후 집계된다.
const EST_OUTPUT_TOKENS = 2200;

/** 대본을 AI에게 넘길 형태로. 화자 이름을 남겨야 "누가 그렇게 말했는가"를 물을 수 있다. */
export function transcriptText(transcript) {
  return transcript.turns.map((t) => `${t.speaker}: ${t.text}`).join("\n\n");
}

/** 4지선다가 성립하는 문제만 남긴다(구조화 출력이 배열 길이·정수 범위를 강제하지 못한다). */
const usable = (set) => ({ ...set, questions: validQuestions(set.questions) });

/**
 * 이미 만들어 둔 문제 세트가 있으면 그것을 준다. AI는 호출하지 않는다.
 * 순서: ① 이 유저가 이미 생성해 둔 것 ② 다른 유저가 Supabase 공용 캐시에 올려 둔 것.
 * 둘 다 없으면 null — 이 경우 estimatedCost()로 비용을 안내하고 확인받은 뒤 generateSet()을 불러야 한다.
 */
export async function readySet(episode) {
  const cached = getSixMinSet(episode.id);
  if (cached) return usable(cached);

  const shared = await getShared("sixmin", episode.id);
  return shared ? usable(shared) : null;
}

/** 이 에피소드의 문제를 지금 새로 만든다면 드는 비용의 대략적인 추정치(달러). */
export function estimatedCost(transcript, level) {
  const promptChars = generateSystem(level).length + transcriptText(transcript).length;
  return estimateUsd(getModel(), { promptChars, estOutputTokens: EST_OUTPUT_TOKENS });
}

/** 실제로 AI를 호출해 문제를 만들고 캐시한다. 이 기능에서 비용이 드는 유일한 지점. */
export async function generateSet(episode, transcript, level) {
  const set = await chatJSON({
    system: generateSystem(level),
    messages: [{ role: "user", content: `Episode: ${episode.title}\n\n${transcriptText(transcript)}` }],
    schema: GENERATE_SCHEMA,
    maxTokens: 3072,
  });
  setSixMinSet(episode.id, set);
  putShared("sixmin", episode.id, set);
  return usable(set);
}
