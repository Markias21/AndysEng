// 🎯 토플 허브의 구성. 정적 데이터만 — UI·저장소를 import하지 않는다.
//
// 2026-01-21 개편 이후의 신형 과제 유형을 영역(R/L/S/W)별로 나열한다.
// 아직 만들지 않은 과제도 "준비 중(N단계)"으로 노출해 남은 작업이 보이게 한다.
// view가 있으면 그 화면으로, mode까지 있으면 그 하위 모드로 바로 들어간다.

/** 신형 리딩·리스닝은 적응형이고 1~6점 척도다(적응형 출제는 범위 밖). */
export const SECTIONS = [
  {
    id: "reading",
    label: "📖 Reading",
    note: "적응형 · 1~6점",
    tasks: [
      { label: "Read an Academic Passage", view: "listening", mode: "paragraph", hint: "지금은 ⚡ 문단 연습으로 대체" },
      { label: "Complete the Words", soon: "3단계" },
      { label: "Read in Daily Life", soon: "4단계" },
    ],
  },
  {
    id: "listening",
    label: "🎧 Listening",
    note: "적응형 · 1~6점",
    tasks: [
      { label: "짧은 듣기 (받아쓰기)", view: "listening", mode: "dictation", hint: "지금은 VOA 짧은 프로그램으로 대체" },
      { label: "Listen and Choose a Response", soon: "4단계" },
      { label: "Conversation · Announcement · Academic Talk", soon: "4단계" },
    ],
  },
  {
    id: "speaking",
    label: "🗣 Speaking",
    note: "준비 시간 없음",
    tasks: [
      { label: "Listen and Repeat (7문장)", soon: "2단계" },
      { label: "Take an Interview (4문항 · 각 45초)", soon: "2단계" },
    ],
  },
  {
    id: "writing",
    label: "✍️ Writing",
    tasks: [
      { label: "Write an Email", view: "writing", mode: "email", hint: "7분 · 100~150단어 · 요구 항목 3개" },
      { label: "Academic Discussion", view: "writing", mode: "discussion", hint: "형식 보정은 3단계" },
      { label: "Build a Sentence", soon: "3단계" },
    ],
  },
];

/** 신형 과제에 딱 맞지는 않지만 어휘·표현·독해를 다지는 데 쓰는 화면들. */
export const EXTRAS = {
  label: "📚 심화 · 자유 학습",
  note: "분량이 길거나 형식이 구형이지만 재료로 유효하다",
  tasks: [
    { label: "📖 긴 리딩 (VOA 350~1200단어)", view: "reading" },
    { label: "🎙 BBC 6 Minute English", view: "sixmin" },
    { label: "📝 문장·표현 다지기", view: "writing-basic", hint: "모범 답안 40편의 빈칸 채우기" },
  ],
};
