// 받아쓰기 빈칸 선택 — 순수 함수, AI 미사용. 난이도별로 어떤 단어를 빈칸으로 만들지 정한다.
// 🎧 3분 학습(VOA)과 🎙 리스닝(BBC 6 Minute English)이 함께 쓴다.
//
// shared/cloze.js의 buildCloze는 "표현(구) 하나가 지문 전체에서 딱 한 번만 빈칸이 되는" 검색
// 방식이라(같은 문장 안에 같은 단어가 여러 번 나오면 첫 등장만 잡힌다), the/is/a처럼 흔한 단어를
// 문장마다 반복해서 빈칸으로 만들어야 하는 받아쓰기(특히 상급 = 전부 빈칸)에는 맞지 않는다.
// 여기서는 위치를 알고 있는 토큰을 직접 자른다 — 다만 출력 shape({translation, parts, blanks})은
// buildCloze와 똑같이 맞춰서 shared/cloze-view.js(weaveHTML 등)를 그대로 재사용한다.
import { checkBlank } from "./cloze.js";

const STOPWORDS = new Set(
  `a an the is am are was were be been being do does did have has had will would shall should
   can could may might must of to in on at by for with about against between into through during
   before after above below from up down out off over under again further then once here there
   when where why how all any both each few more most other some such no nor not only own same
   so than too very and but or if because as until while this that these those i you he she it
   we they me him her us them my your his its our their myself yourself himself herself itself
   ourselves yourselves themselves what which who whom whose s t just now also very`
    .split(/\s+/)
    .filter(Boolean)
);

function isContentWord(word) {
  return !STOPWORDS.has(word.toLowerCase());
}

const PREDICATES = {
  basic: (word) => isContentWord(word) && word.length >= 6,
  mid: (word) => isContentWord(word),
  high: () => true,
};

export const DEFAULT_DIFFICULTY = "mid";

export const DIFFICULTIES = [
  { id: "basic", label: "🌱 초급", ko: "적은 빈칸 (긴 내용어만)" },
  { id: "mid", label: "🌿 중급", ko: "많은 빈칸 (내용어 전부)" },
  { id: "high", label: "🌳 상급", ko: "전부 빈칸 (문장 전체)" },
];

export function findDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) || null;
}

// 단어 = 알파벳(+어퍼스트로피 축약형). 캡처 그룹을 쓰면 split이 단어도 결과 배열에 포함시켜,
// [구분자, 단어, 구분자, 단어, ..., 구분자]로 번갈아 나온다.
const WORD_RE = /([A-Za-z]+(?:['’][A-Za-z]+)*)/g;

function blankLine(text, shouldBlank) {
  const tokens = text.split(WORD_RE);
  const parts = [];
  const blanks = [];
  let buffer = "";
  tokens.forEach((tok, i) => {
    const isWord = i % 2 === 1;
    if (isWord && shouldBlank(tok)) {
      parts.push(buffer);
      blanks.push({ answer: tok });
      buffer = "";
    } else {
      buffer += tok;
    }
  });
  parts.push(buffer);
  return { translation: "", parts, blanks };
}

/**
 * 문단에서 받아쓰기 빈칸 라인을 만든다.
 * paragraphs: [{type, text}] (type이 "para"인 것만 쓴다)
 * difficulty: "basic" | "mid" | "high" (모르는 값이면 기본 난이도로 본다)
 * 반환: [{translation, parts, blanks: [{answer}]}] — shared/cloze-view.js의 weaveHTML 입력과 동일한 shape.
 */
export function buildDictation(paragraphs, difficulty) {
  const shouldBlank = PREDICATES[difficulty] || PREDICATES[DEFAULT_DIFFICULTY];
  return (paragraphs || []).filter((p) => p.type === "para").map((p) => blankLine(p.text, shouldBlank));
}

/** 빈칸 전체 개수. */
export function countBlanks(lines) {
  return lines.reduce((n, l) => n + l.blanks.length, 0);
}

/** typedByBlank: 빈칸 인덱스별 [단어1글자...] 배열(readWords 결과). 정답 여부를 순서대로 반환. */
export function gradeDictation(lines, typedByBlank) {
  const flat = lines.flatMap((l) => l.blanks);
  return flat.map((blank, i) => checkBlank(typedByBlank[i]?.[0] ?? "", blank.answer));
}
