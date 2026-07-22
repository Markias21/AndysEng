// 토플 라이팅(Academic Discussion) 홀리스틱 채점 밴드(0~4). AI가 이 기준으로 글에 한 점수를 매긴다.
// en: AI 프롬프트용(영어), ko: 화면 표시용(한국어 요약).
// 오타·대소문자·철자 실수는 밴드를 깎지 않는다(shared/scoring.js의 GRAMMAR_RUBRIC와 일치).
export const TOEFL_WRITING_BANDS = [
  {
    score: 4,
    ko: "주제에 매우 명확히 기여하고 일관된 언어 능력을 보임. 다양한 문장 구조·정확한 단어·관용어구를 유능하게 사용하며, 사소한 오타 외에는 오류가 거의 없음.",
    en: "Fully addresses the online-discussion topic and contributes very clearly with consistent facility. Explanations, examples, and details are relevant and clearly presented. Uses a wide range of syntax and precise words and idioms skillfully. Almost no vocabulary or grammar errors, aside from minor typos or spelling slips.",
  },
  {
    score: 3,
    ko: "주제에 기여하며 아이디어를 쉽게 이해할 수 있음. 설명·예시가 적절하고, 다양한 문장 구조·적절한 단어를 사용하며 오류가 많지 않음.",
    en: "Addresses the topic and contributes; the language makes the ideas easy to understand. Explanations, examples, and details are relevant and adequately explained. Uses varied sentence structures and appropriate words. Not many vocabulary or grammar errors.",
  },
  {
    score: 2,
    ko: "주제와 대부분 관련되고 이해할 수 있는 수준으로 기여함. 설명·예시 일부가 누락·불분명·비연관이고, 눈에 띄는 어휘·문법 오류가 몇몇 있음.",
    en: "Mostly relevant to the topic and contributes at an understandable level. Some explanations, examples, or details are missing, unclear, or unconnected. Uses a fair variety of sentence structures and words. A few noticeable vocabulary or grammar errors.",
  },
  {
    score: 1,
    ko: "기여하려는 시도는 있으나 언어 능력의 한계로 아이디어를 이해하기 어려움. 문장 구조·어휘가 제한적이고 오류가 자주 보임.",
    en: "Attempts to contribute, but language limitations make the ideas hard to understand. Explanations are insufficient or only partly relevant. Limited range of sentence structure and vocabulary. Frequent vocabulary or grammar errors.",
  },
  {
    score: 0,
    ko: "토론에 기여하지 못하고 언어 능력의 한계로 아이디어를 표현하지 못함. 심각한 오류가 빈번함. (무응답·주제 이탈·비영어·문제 복사도 0점)",
    en: "Does not contribute to the discussion and cannot express ideas due to language limitations. Ideas are incoherent. Very limited range of sentence structure and vocabulary. Frequent serious vocabulary or grammar errors. Also score 0 if the response is blank, off-topic, not in English, or merely copies the prompt.",
  },
];

/** AI 프롬프트에 넣을 "4: ...\n3: ..." 밴드 블록. */
export function toeflPromptBlock() {
  return TOEFL_WRITING_BANDS.map((b) => `${b.score}: ${b.en}`).join("\n");
}

/** 점수(0~4)에 해당하는 밴드. 범위를 벗어나면 0점 밴드로 본다. */
export function toeflBand(score) {
  return TOEFL_WRITING_BANDS.find((b) => b.score === score) || TOEFL_WRITING_BANDS[TOEFL_WRITING_BANDS.length - 1];
}
