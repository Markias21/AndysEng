// 막힌 곳 표시(gap marking). 순수 함수만 — UI·저장소를 import하지 않는다.
//
// 쓰다가 영어가 안 떠오르면 `(~에 큰 영향을 미치다)`처럼 한글이 들어간 괄호로 표시하고 넘어간다.
// 첨삭이 괄호마다 해답 표현을 돌려주고(gap_solutions), 그 표현은 며칠 뒤 다시 쓰기에서 인출한다.
//
// 번역기를 쓰면 감점이지만 이 표시는 감점하지 않는다 — 막힌 곳을 스스로 알아차려 표시하는 것 자체가
// 학습 행위이기 때문이다(Hanaoka 2007의 "안내된 주목").

// 한글 음절·자모. 영어만 든 괄호는 일반 괄호로 보고 건드리지 않는다.
const HANGUL = /[ㄱ-ㆎ가-힣]/;

// 반각 ()와 전각 （）를 모두 받는다. 안쪽에 괄호가 없는 쌍만 잡으므로 중첩은 가장 안쪽이 걸린다.
const PAIR = /[(（]([^()（）]*)[)）]/g;

/**
 * 글에서 막힌 곳 표시를 뽑는다.
 * → [{ ko, index }] — ko는 괄호 안 한국어(양끝 공백 제거), index는 여는 괄호의 위치.
 * 빈 괄호와 한글이 없는 괄호는 건너뛴다.
 */
export function extractGaps(text) {
  const out = [];
  const source = String(text ?? "");
  PAIR.lastIndex = 0;
  let m;
  while ((m = PAIR.exec(source)) !== null) {
    const ko = m[1].trim();
    if (!ko || !HANGUL.test(ko)) continue;
    out.push({ ko, index: m.index });
  }
  return out;
}
