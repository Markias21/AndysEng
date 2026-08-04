// 토플 리스닝 문제 유형. 순수 데이터 — UI/저장소/AI를 import하지 않는다.
//
// 실제 토플 iBT Listening의 문항 유형 중, 대화체 방송 하나만 있으면 성립하고 4지선다로 출제되는
// 것들을 골랐다. 4지선다라서 정답 키만 함께 받아 두면 채점이 100% 로컬에서 끝난다(재도전 무료).
// 리딩(features/reading/types.js)과 겹치지 않는다 — 듣기는 화자의 태도·의도·대화 구조를 더 묻는다.
export const QUESTION_TYPES = [
  {
    id: "gist_content",
    label: "주제",
    ko: "이 방송이 전체적으로 무엇에 관한 것인지 묻습니다.",
    prompt: "Gist-Content: ask what the discussion is mainly about. Wrong options should be real but minor details from the episode.",
  },
  {
    id: "gist_purpose",
    label: "목적",
    ko: "화자가 왜 그 이야기를 꺼냈는지를 묻습니다.",
    prompt: "Gist-Purpose: ask why a speaker brings something up, or what a section of the discussion is meant to accomplish.",
  },
  {
    id: "detail",
    label: "세부 정보",
    ko: "방송에서 분명히 말한 사실을 묻습니다.",
    prompt: "Detail: ask about a fact that a speaker states explicitly. The answer must be directly stated in the transcript.",
  },
  {
    id: "function",
    label: "발화 의도",
    ko: "특정 발언을 왜 그렇게 말했는지를 묻습니다.",
    prompt:
      'Function of What Is Said: quote a short line from the transcript in the stem ("Why does the speaker say ...?") and ask what the speaker means by it, beyond its literal wording.',
  },
  {
    id: "attitude",
    label: "화자의 태도",
    ko: "화자가 어떤 입장·감정을 가지고 있는지를 묻습니다.",
    prompt: "Speaker's Attitude: ask about a speaker's opinion, certainty or feeling about something, as revealed by how they say it.",
  },
  {
    id: "organization",
    label: "대화 구성",
    ko: "대화가 어떤 순서·방식으로 전개되는지를 묻습니다.",
    prompt:
      "Organization: ask how the discussion is structured — for example how one part relates to another, or why an interview clip is placed where it is.",
  },
  {
    id: "inference",
    label: "추론",
    ko: "직접 말하지는 않았지만 반드시 참인 것을 고릅니다.",
    prompt:
      "Inference: ask what can be inferred. The answer must follow necessarily from what was said but must NOT be stated word-for-word.",
  },
];

export const QUESTION_TYPE_IDS = QUESTION_TYPES.map((t) => t.id);

export function findType(id) {
  return QUESTION_TYPES.find((t) => t.id === id) || null;
}

/** 유형 라벨(모르는 id면 그대로 보여 준다 — 데이터가 앞서가도 화면이 깨지지 않게). */
export function typeLabel(id) {
  return findType(id)?.label ?? id;
}
