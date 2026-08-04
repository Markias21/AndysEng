// 리딩 채점. 객관식 채점은 리스닝과 똑같아 shared/mcq.js로 옮겼고, 여기에는 리딩에만 있는
// 표현 빈칸 채점과 리딩 문제 유형에 묶인 부분만 남는다. 순수 함수만 — UI/저장소/AI를 import하지 않는다.
//
// 리딩 화면은 채점 API를 이 파일 하나에서 가져간다. 그래서 공유로 옮긴 것들도 여기서 다시 내보낸다.
import { checkWords } from "../../shared/cloze.js";
import { CORRECT, SKIPPED, WRONG, weakTypes as mcqWeakTypes } from "../../shared/mcq.js";
import { typeLabel } from "./types.js";

export { CORRECT, WRONG, SKIPPED, comprehensionSummary, gradeChoices, validQuestions } from "../../shared/mcq.js";

/**
 * 빈칸 채점. 표현 전체가 맞아야 정답이지만 어디가 틀렸는지 보여 주려고 단어별 결과도 함께 낸다.
 * 한 글자도 쓰지 않았으면 스킵.
 * blanks: [{expression}] · typed: string[][] (빈칸별 단어 입력)
 */
export function gradeBlanks(blanks, typed) {
  return (blanks || []).map((b, i) => {
    const words = typed?.[i] ?? [];
    const wordFlags = checkWords(words, b.expression);
    const empty = words.every((w) => !String(w ?? "").trim());
    return {
      index: i,
      wordFlags,
      status: empty ? SKIPPED : wordFlags.every(Boolean) ? CORRECT : WRONG,
    };
  });
}

/** 틀린 문제가 많은 리딩 유형부터. 유형 이름표만 리딩 것으로 끼워 넣는다. */
export function weakTypes(choiceResults) {
  return mcqWeakTypes(choiceResults, typeLabel);
}
