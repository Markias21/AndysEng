// 글쓰기 기본에서 쓰는 논설문 템플릿 4종. 정적 데이터 — AI 호출 없이 로컬에서만 제공한다.
// 토플 독립형 라이팅에 나오는 질문 유형을 네 갈래로 나눈 것이고, 모든 모범 답안은 이 중 하나의 골격을 따른다.
// 연습 화면에서 "이 글의 구조"를 펼치면 skeletonHTML이 그대로 보인다.

export const TEMPLATES = [
  {
    id: "preference",
    label: "🔀 선호 선택형",
    ko: "A와 B 중 하나를 고르고 왜 그쪽이 나은지 설명하는 글",
    skeletonHTML: `
<ol class="structure-steps">
  <li><b>선택 선언</b> — 어느 쪽인지 한 문장으로 못 박는다. <span class="reason">In my opinion, A is far better than B.</span></li>
  <li><b>이유 1 + 내 경험</b> — First of all로 첫 이유를 대고, 실제 겪은 일로 뒷받침한다.</li>
  <li><b>이유 2 + 근거</b> — In addition으로 다른 각도의 이유를 더한다.</li>
  <li><b>반대편 인정</b> — Admittedly로 B의 장점을 솔직히 인정한 뒤 However로 뒤집는다.</li>
  <li><b>재확인</b> — In conclusion으로 선택을 다시 못 박는다.</li>
</ol>`,
  },
  {
    id: "agree",
    label: "⚖️ 찬성·반대형",
    ko: "주장에 찬성하는지 반대하는지 입장을 정하고 근거를 대는 글",
    skeletonHTML: `
<ol class="structure-steps">
  <li><b>입장 표명</b> — 찬성인지 반대인지 분명히 한다. <span class="reason">I strongly agree that ...</span></li>
  <li><b>근거 1</b> — To begin with으로 가장 강한 근거부터.</li>
  <li><b>근거 2</b> — Furthermore로 성격이 다른 두 번째 근거.</li>
  <li><b>반론 재반박</b> — Some people argue that ... 로 반대 의견을 요약하고 However로 되받는다.</li>
  <li><b>결론</b> — For these reasons로 입장을 다시 정리한다.</li>
</ol>`,
  },
  {
    id: "tradeoff",
    label: "🔍 양면 평가형",
    ko: "득과 실이 모두 있는 문제를 저울질해 판정을 내리는 글",
    skeletonHTML: `
<ol class="structure-steps">
  <li><b>양쪽 인정</b> — 이 문제에 두 얼굴이 있음을 먼저 인정한다. <span class="reason">There is no denying that X has two sides.</span></li>
  <li><b>이점</b> — On the one hand로 좋은 쪽을 구체적으로.</li>
  <li><b>대가</b> — On the other hand로 치르는 대가를 짚는다.</li>
  <li><b>저울질</b> — When we weigh these against each other로 무엇이 더 무거운지 따진다.</li>
  <li><b>판정</b> — Overall로 결론을 내린다 (한쪽으로 기운 판정이어야 한다).</li>
</ol>`,
  },
  {
    id: "policy",
    label: "🏛 정책 제안형",
    ko: "정부·학교가 어떤 조치를 해야 하는지 묻는 글",
    skeletonHTML: `
<ol class="structure-steps">
  <li><b>문제 제시</b> — 무엇이 왜 문제인지 한 문장으로.</li>
  <li><b>제안</b> — 그래서 무엇을 해야 하는지 분명히 밝힌다.</li>
  <li><b>기대 효과</b> — The most immediate benefit would be ... 로 이득을 설명한다.</li>
  <li><b>우려 해소</b> — Critics may point out that ... 로 비용·부작용 걱정을 다루고 답한다.</li>
  <li><b>결론</b> — In the long run으로 장기적 이득을 강조하며 마무리한다.</li>
</ol>`,
  },
];

export function findTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}
