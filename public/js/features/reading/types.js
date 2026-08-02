// 토플 리딩 문제 유형. 순수 데이터 — UI/저장소/AI를 import하지 않는다.
//
// 실제 토플 iBT Reading의 문항 유형 중, 지문 하나만 있으면 성립하고 4지선다로 출제되는 것들을 골랐다.
// 4지선다라서 정답 키만 함께 받아 두면 채점이 100% 로컬에서 끝난다(AI 호출 0회 → 매 시도 무료).
export const QUESTION_TYPES = [
  {
    id: "factual",
    label: "사실 정보",
    ko: "지문에 명시된 사실을 묻습니다.",
    prompt: "Factual Information: ask what the passage explicitly states. The answer must be directly stated in the passage.",
  },
  {
    id: "negative",
    label: "부정 사실",
    ko: "지문에 나오지 않거나 사실이 아닌 것을 고릅니다 (NOT / EXCEPT).",
    prompt:
      "Negative Factual Information: phrase the stem with NOT or EXCEPT. Three options are stated in the passage; the correct answer is the one that is not.",
  },
  {
    id: "inference",
    label: "추론",
    ko: "지문에 직접 쓰여 있지는 않지만 반드시 참인 것을 고릅니다.",
    prompt:
      "Inference: ask what can be inferred. The answer must follow necessarily from the passage but must NOT be stated word-for-word in it.",
  },
  {
    id: "purpose",
    label: "수사적 의도",
    ko: "글쓴이가 왜 그 내용을 언급했는지를 묻습니다.",
    prompt:
      "Rhetorical Purpose: ask why the author mentions something or what a paragraph accomplishes (e.g. to illustrate, to contrast, to explain a cause).",
  },
  {
    id: "vocabulary",
    label: "어휘",
    ko: "지문 속 단어가 그 문맥에서 어떤 뜻인지를 묻습니다.",
    prompt:
      "Vocabulary: quote one word or short phrase from the passage in the stem and ask what it means in that context. Options must all be plausible meanings of the word.",
  },
  {
    id: "simplify",
    label: "문장 재진술",
    ko: "지문의 한 문장과 뜻이 가장 가까운 재진술을 고릅니다.",
    prompt:
      "Sentence Simplification: quote one complex sentence from the passage in the stem and ask which choice best restates it. Wrong options must drop essential information or change the meaning.",
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
