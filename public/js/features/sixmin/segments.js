// 대본을 받아쓰기 구간으로 나누고, 구간이 오디오의 어디쯤인지 추정한다. 순수 함수만.
//
// BBC 대본에는 타임스탬프가 없다. 그래서 "지금까지 나온 단어 수 ÷ 전체 단어 수 × 오디오 길이"로
// 시작 시각을 추정한다. 대본형 방송이라 말 빠르기가 고른 편이지만 어디까지나 어림값이라,
// 화면에서 ±5초 보정 버튼과 함께 쓴다(정확한 시각을 아는 척하지 않는다).
import { wordsIn } from "./transcript.js";

// 구간 하나의 목표 분량(단어). 6분 방송이 900~1000단어이므로 약 9~10구간, 한 구간은 35초 안팎이다.
const TARGET_WORDS = 110;

/**
 * 화자 턴들을 구간으로 묶는다. 턴을 쪼개지 않으므로 구간마다 분량이 조금씩 다르다.
 * turns: [{speaker, text}]
 * 반환: [{index, turns, words, startWord}]
 */
export function buildSegments(turns, targetWords = TARGET_WORDS) {
  const segments = [];
  let current = null;
  let startWord = 0;

  for (const turn of turns || []) {
    if (!current) current = { index: segments.length, turns: [], words: 0, startWord };
    current.turns.push(turn);
    current.words += wordsIn(turn.text);
    if (current.words >= targetWords) {
      segments.push(current);
      startWord += current.words;
      current = null;
    }
  }
  // 마지막 자투리는 버리지 않고 앞 구간에 붙인다 — 한두 문장짜리 구간을 만들지 않기 위해서다.
  if (current) {
    const last = segments[segments.length - 1];
    if (last) {
      last.turns.push(...current.turns);
      last.words += current.words;
    } else {
      segments.push(current);
    }
  }
  return segments;
}

/**
 * 구간이 시작하는 오디오 시각(초, 추정). 전체 단어 수나 오디오 길이를 모르면 0을 준다
 * (오디오 메타데이터가 아직 안 실렸을 때 — 그냥 처음부터 재생된다).
 */
export function startSecOf(segment, totalWords, durationSec) {
  if (!segment || !totalWords || !durationSec) return 0;
  return (segment.startWord / totalWords) * durationSec;
}

/** 구간 라벨. 추정 시각을 mm:ss로 보여 준다. */
export function formatClock(sec) {
  const whole = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
