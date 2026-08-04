// BBC 6 Minute English 대본 PDF에서 뽑은 줄 목록 → 화자별 대사와 어휘로. 순수 함수만.
//
// 대본 PDF의 구조는 전 회차가 같다:
//   BBC LEARNING ENGLISH / 6 Minute English / <제목> / "This is not a word-for-word transcript."
//   <화자 이름>          ← 짧은 줄 하나
//   <대사>               ← 여러 줄
//   ... (반복)
//   VOCABULARY
//   <용어> / <영어 정의>  ← 6개
// 페이지마다 머리말·꼬리말이 끼어들고, 심볼 폰트로 찍힌 탭이 "!"로 남는다.

const JUNK = [
  /^BBC LEARNING ENGLISH$/i,
  /^6 Minute English$/i,
  /^worksheet$/i,
  /©\s*British Broadcasting Corporation/i,
  /bbclearningenglish\.com/i,
  /^Page \d+ of \d+$/i,
  /word[-\s]?for[-\s]?word transcript/i,
];

// 심볼 폰트(탭·글머리표)가 남긴 문자만 있는 줄. 문단 경계(빈 줄)로 본다.
const SYMBOL_ONLY = /^[!¥•\s]*$/;

const VOCABULARY_HEADING = /^VOCABULARY$/i;
// 화자 이름 줄: 짧고, 문장부호로 끝나지 않으며, 대문자로 시작한다.
const SPEAKER = /^[A-Z][A-Za-z.'’’ -]{0,30}$/;

/** 머리말·꼬리말·심볼 잔재를 걷어내고, 문단 경계는 빈 문자열 하나로 남긴다. */
function clean(lines, title) {
  const out = [];
  for (const raw of lines) {
    const line = String(raw ?? "").trim();
    if (SYMBOL_ONLY.test(line)) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    if (JUNK.some((re) => re.test(line))) continue;
    // 제목은 표지에도 페이지마다도 나온다. index.json에 이미 있으니 본문에서는 지운다.
    if (title && line.toLowerCase() === String(title).toLowerCase()) continue;
    out.push(line);
  }
  while (out.length && out[0] === "") out.shift();
  return out;
}

function isSpeaker(line, previous) {
  // 문단이 새로 시작하는 자리에서만 화자로 본다 — 대사 중간의 짧은 줄을 화자로 오인하지 않기 위해서다.
  return previous === "" && SPEAKER.test(line) && line.split(/\s+/).length <= 4;
}

/** 대사 줄들을 화자별로 묶는다. [{speaker, text}] */
function toTurns(lines) {
  const turns = [];
  lines.forEach((line, i) => {
    if (!line) return;
    if (isSpeaker(line, i ? lines[i - 1] : "")) {
      turns.push({ speaker: line, text: "" });
      return;
    }
    if (!turns.length) return; // 첫 화자 앞의 표지 문구는 버린다.
    const turn = turns[turns.length - 1];
    turn.text = turn.text ? `${turn.text} ${line}` : line;
  });
  return turns.filter((t) => t.text);
}

/** VOCABULARY 아래를 빈 줄로 끊어 [{word, definition}]로. 정의가 없는 항목은 버린다. */
function toVocabulary(lines) {
  const entries = [];
  let block = [];
  const flush = () => {
    if (block.length >= 2) entries.push({ word: block[0], definition: block.slice(1).join(" ") });
    block = [];
  };
  for (const line of lines) {
    if (line) block.push(line);
    else flush();
  }
  flush();
  return entries;
}

/**
 * PDF 줄 목록 → {turns, vocabulary, words}
 * lines: shared/pdf-text.js의 pdfPages 결과를 페이지 순서대로 이어 붙인 것
 * title: index.json의 에피소드 제목(본문에서 지우는 데만 쓴다)
 */
export function parseTranscript(lines, title) {
  const cleaned = clean(lines, title);
  const at = cleaned.findIndex((line) => VOCABULARY_HEADING.test(line));
  const body = at < 0 ? cleaned : cleaned.slice(0, at);
  const turns = toTurns(body);
  return {
    turns,
    vocabulary: at < 0 ? [] : toVocabulary(cleaned.slice(at + 1)),
    words: turns.reduce((n, t) => n + wordsIn(t.text), 0),
  };
}

/** 대사 한 턴의 단어 수. 구간 시작 시각을 비례로 추정할 때 쓴다. */
export function wordsIn(text) {
  return String(text ?? "").split(/\s+/).filter(Boolean).length;
}

/**
 * 어휘가 실제로 쓰인 대본 문장을 찾아 준다(복습 카드의 예문으로 쓴다). 없으면 빈 문자열.
 * BBC 어휘에는 "set a good/bad example", "(someone's) jaw dropped"처럼 대본에 그대로는
 * 나오지 않는 표제형이 섞여 있어, 못 찾으면 예문 없이 담는다.
 */
export function exampleFor(turns, word) {
  const needle = String(word ?? "").toLowerCase();
  if (!needle) return "";
  for (const turn of turns || []) {
    for (const sentence of turn.text.split(/(?<=[.!?])\s+/)) {
      if (sentence.toLowerCase().includes(needle)) return sentence.trim();
    }
  }
  return "";
}
