// 글쓰기 "구조 제시" 버튼용 정적 데이터. AI 호출 없이 로컬에서만 제공한다.
// 템플릿은 논설문 5단 구조 가이드, 표현은 그 구조를 채울 때 쓰는 신호어(signal word) 모음이다.

export const structureTemplateHTML = `
<ol class="structure-steps">
  <li><b>도입 (Thesis)</b> — 주장을 한 문장으로. <span class="reason">In my opinion, remote work should become the standard.</span></li>
  <li><b>이유 1</b> — First / To begin with으로 첫 번째 이유.</li>
  <li><b>이유 2</b> — In addition / Furthermore로 두 번째 이유 추가.</li>
  <li><b>반론 고려 (선택)</b> — However / Admittedly로 반대 의견을 짚고 재반박.</li>
  <li><b>결론</b> — In conclusion / To sum up으로 주장을 다시 정리.</li>
</ol>`;

export const structureExpressions = [
  { expression: "In my opinion", meaning: "제 생각에는", example: "In my opinion, remote work increases productivity." },
  { expression: "I firmly believe that", meaning: "저는 굳게 믿습니다", example: "I firmly believe that technology improves education." },
  { expression: "At first glance", meaning: "언뜻 보기에는", example: "At first glance, the plan seems risky." },
  { expression: "To begin with", meaning: "우선", example: "To begin with, exercise boosts mental health." },
  { expression: "First and foremost", meaning: "무엇보다 먼저", example: "First and foremost, safety should come first." },
  { expression: "In addition", meaning: "게다가", example: "In addition, it saves money." },
  { expression: "Furthermore", meaning: "더욱이", example: "Furthermore, it reduces stress." },
  { expression: "Moreover", meaning: "더 나아가", example: "Moreover, studies support this claim." },
  { expression: "What is more", meaning: "더욱이", example: "What is more, it builds confidence." },
  { expression: "On top of that", meaning: "그것에 더해", example: "On top of that, it creates jobs." },
  { expression: "Not only... but also", meaning: "~뿐만 아니라 ~도", example: "It is not only cheap but also effective." },
  { expression: "Besides", meaning: "게다가", example: "Besides, it's environmentally friendly." },
  { expression: "As a result", meaning: "그 결과", example: "As a result, sales increased." },
  { expression: "Therefore", meaning: "그러므로", example: "Therefore, we should act now." },
  { expression: "Consequently", meaning: "그 결과로", example: "Consequently, prices fell." },
  { expression: "This leads to", meaning: "이는 ~로 이어진다", example: "This leads to higher costs." },
  { expression: "Due to this", meaning: "이 때문에", example: "Due to this, many people quit." },
  { expression: "For this reason", meaning: "이런 이유로", example: "For this reason, I support the policy." },
  { expression: "However", meaning: "그러나", example: "However, some disagree." },
  { expression: "On the other hand", meaning: "반면에", example: "On the other hand, costs are high." },
  { expression: "In contrast", meaning: "대조적으로", example: "In contrast, rural areas lack access." },
  { expression: "Nevertheless", meaning: "그럼에도 불구하고", example: "Nevertheless, the plan succeeded." },
  { expression: "Despite this", meaning: "그럼에도", example: "Despite this, many still oppose it." },
  { expression: "That said", meaning: "그렇긴 해도", example: "That said, risks remain." },
  { expression: "Although", meaning: "비록 ~이지만", example: "Although it is expensive, it works." },
  { expression: "For example", meaning: "예를 들어", example: "For example, Sweden reduced emissions." },
  { expression: "For instance", meaning: "예를 들면", example: "For instance, students improved scores." },
  { expression: "To illustrate", meaning: "예를 들자면", example: "To illustrate, consider this case." },
  { expression: "Take ... for example", meaning: "~을 예로 들면", example: "Take Finland for example." },
  { expression: "A case in point is", meaning: "대표적인 예가 ~이다", example: "A case in point is renewable energy." },
  { expression: "Indeed", meaning: "실제로", example: "Indeed, the data confirms this." },
  { expression: "In fact", meaning: "사실", example: "In fact, most people agree." },
  { expression: "Above all", meaning: "무엇보다도", example: "Above all, honesty matters." },
  { expression: "Notably", meaning: "특히", example: "Notably, costs dropped sharply." },
  { expression: "It is worth noting that", meaning: "주목할 점은 ~라는 것이다", example: "It is worth noting that trends shift quickly." },
  { expression: "In conclusion", meaning: "결론적으로", example: "In conclusion, the benefits outweigh the risks." },
  { expression: "To sum up", meaning: "요약하자면", example: "To sum up, both sides have merit." },
  { expression: "All things considered", meaning: "모든 것을 고려할 때", example: "All things considered, the policy should pass." },
  { expression: "Overall", meaning: "전반적으로", example: "Overall, the results are positive." },
  { expression: "In short", meaning: "간단히 말해", example: "In short, change is necessary." },
  { expression: "Ultimately", meaning: "결국", example: "Ultimately, choices depend on values." },
  { expression: "In other words", meaning: "다시 말해", example: "In other words, it saves time." },
  { expression: "That is to say", meaning: "즉", example: "That is to say, quality matters more than quantity." },
  { expression: "Admittedly", meaning: "인정하건대", example: "Admittedly, the process is slow." },
  { expression: "Granted", meaning: "물론 그렇지만", example: "Granted, costs are high, but benefits last." },
];
