// 토플 라이팅(Write an Email) 홀리스틱 채점 밴드(0~5). AI가 이 기준으로 이메일에 한 점수를 매긴다.
// en: AI 프롬프트용(영어), ko: 화면 표시용(한국어 요약).
// 오타·대소문자·철자 실수는 밴드를 깎지 않는다(shared/scoring.js의 GRAMMAR_RUBRIC와 일치).
export const TOEFL_EMAIL_BANDS = [
  {
    score: 5,
    ko: "요구된 항목을 모두 명확하고 충분한 디테일로 다룸. 수신자에 맞는 어조를 일관되게 유지하며, 사소한 오타 외에는 오류가 거의 없음.",
    en: "Fully addresses all required bullet points with clear, sufficient detail. Maintains a consistently appropriate tone for the recipient throughout. Almost no vocabulary or grammar errors, aside from minor typos or spelling slips.",
  },
  {
    score: 4,
    ko: "요구된 항목을 대부분 다루며 목적이 분명함. 어조가 대체로 적절하고, 사소한 어조·언어 문제가 있음.",
    en: "Addresses most of the required bullet points; the purpose of the email is clear. Tone is generally appropriate for the recipient, with only minor tone or language issues.",
  },
  {
    score: 3,
    ko: "기본적인 항목은 다루지만 디테일이 고르지 않거나 조직이 엉성함. 눈에 띄는 언어 오류가 있음.",
    en: "Covers the basic content but with uneven detail or weak organization between greeting, body, and closing. Noticeable language errors are present.",
  },
  {
    score: 2,
    ko: "일부 항목을 놓치고 구조나 어조가 약함. 오류가 많음.",
    en: "Misses some required bullet points; weak structure or a tone that does not suit the recipient. Many vocabulary or grammar errors.",
  },
  {
    score: 1,
    ko: "언어 능력의 한계로 최소한의 의사만 전달됨. 주제 이탈이거나 대부분 불완전함.",
    en: "Minimal control of the language; the email is largely off-topic or incomplete, with frequent serious errors.",
  },
  {
    score: 0,
    ko: "무응답이거나 이메일 형식을 전혀 갖추지 못함. (주제 이탈·비영어·문제 복사도 0점)",
    en: "No response, or the response does not take the form of an email at all. Also score 0 if the response is blank, off-topic, not in English, or merely copies the prompt.",
  },
];

/** AI 프롬프트에 넣을 "5: ...\n4: ..." 밴드 블록. */
export function emailPromptBlock() {
  return TOEFL_EMAIL_BANDS.map((b) => `${b.score}: ${b.en}`).join("\n");
}

/** 점수(0~5)에 해당하는 밴드. 범위를 벗어나면 0점 밴드로 본다. */
export function emailBand(score) {
  return TOEFL_EMAIL_BANDS.find((b) => b.score === score) || TOEFL_EMAIL_BANDS[TOEFL_EMAIL_BANDS.length - 1];
}
