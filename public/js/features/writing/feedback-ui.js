// 첨삭 결과 렌더. DOM 문자열만 만들고 상태는 갖지 않는다(ui.js가 심고 배선한다).
import {
  esc, scoreBreakdownHTML, correctionsHTML, spellingHTML,
  sentenceLinesHTML, translatorPenaltyHTML, nonLiteralBadge,
} from "../../shared/dom.js";
import { getProfile } from "../../shared/store.js";
import { toeflBand } from "./toefl.js";
import { emailBand } from "./email.js";

/** bullets_covered([{bullet, covered, comment}])를 체크리스트로 렌더한다. */
function bulletsCoveredHTML(bulletsCovered) {
  return `<ul class="bullet-list">${(bulletsCovered || [])
    .map(
      (b) =>
        `<li class="${b.covered ? "bullet-ok" : "bullet-miss"}">${b.covered ? "✅" : "❌"} ${esc(b.bullet)}<br/><span class="reason">${esc(b.comment)}</span></li>`
    )
    .join("")}</ul>`;
}

/**
 * 🧩 막혔던 곳. 내가 쓴 한국어 → 그 자리에 쓸 영어 표현.
 * 복습에 담는 ➕ 버튼은 ui.js가 wireExpressionAdds로 배선한다(원어민 표현 목록과 같은 방식).
 */
export function gapSolutionsHTML(gapSolutions) {
  return (gapSolutions || [])
    .map(
      (g, i) => `<div class="expr-item gap-item">
        <div class="gap-ko">🧩 ${esc(g.ko)}</div>
        <div><b>${esc(g.expression)}</b>${g.level ? ` <span class="chip">${esc(g.level)}</span>` : ""}${nonLiteralBadge(g.non_literal)}</div>
        <div class="reason">${esc(g.meaning)}</div>
        ${g.example ? `<div class="small">${esc(g.example)}</div>` : ""}
        ${g.example_ko ? `<div class="small muted">${esc(g.example_ko)}</div>` : ""}
        <div class="row-end"><button class="btn-text expr-add" type="button" data-i="${i}">➕ 복습에 추가</button></div>
      </div>`
    )
    .join("");
}

export function feedbackHTML(r, mode) {
  const isEmail = mode === "email";
  const band = isEmail ? emailBand(r.toefl_score) : toeflBand(r.toefl_score);
  const maxScore = isEmail ? 5 : 4;
  const bulletsSection = isEmail
    ? `<h4>📋 요구 항목 충족 여부</h4><div class="card">${bulletsCoveredHTML(r.bullets_covered)}</div>`
    : "";
  // 막혔던 곳은 원어민 표현보다 위에 둔다 — 스스로 막혔다고 표시한 자리라 가장 눈에 남는다.
  const gapSection = r.gap_solutions?.length
    ? `<h4>🧩 막혔던 곳 <span class="reason">(괄호로 표시한 자리예요. 감점은 없어요)</span></h4>
    <div class="card" id="writing-gaps"></div>`
    : "";
  return `
    <h4>🎯 TOEFL ${isEmail ? "이메일" : "라이팅"} <span class="cefr">${r.toefl_score} / ${maxScore}</span></h4>
    <div class="card">${esc(band.ko)}</div>
    ${bulletsSection}
    <h4>🏅 점수 <span class="cefr">이 글의 레벨: ${esc(r.cefr_level)}</span></h4>
    <div class="card">${scoreBreakdownHTML(isEmail ? "email" : "writing", r.grades)}${translatorPenaltyHTML(r.translatorUses, r.penalty, r.total)}</div>
    <h4>📝 문법 첨삭</h4>
    <div class="card">${r.corrections.length ? correctionsHTML(r.corrections) : "✅ 문법 오류가 없어요!"}</div>
    ${r.spelling?.length ? `<h4>✏️ 오타·대소문자 <span class="reason">(점수에는 반영하지 않아요)</span></h4>
    <div class="card">${spellingHTML(r.spelling)}</div>` : ""}
    <h4>✔️ 교정된 답안</h4>
    <div class="card">${sentenceLinesHTML(r.corrected_answer)}</div>
    <h4>🌟 원어민 모범 ${isEmail ? "이메일" : "답안"} <span class="cefr">${esc(getProfile().level)}</span></h4>
    <div class="card">${sentenceLinesHTML(r.native_answer)}</div>
    ${gapSection}
    <h4>💡 익혀두면 좋은 표현 <span class="reason">(담을 것만 골라 복습에 추가하세요)</span></h4>
    <div class="card" id="writing-exprs"></div>
    <h4>💬 첨삭에 대해 질문하기</h4>
    <div class="card">
      <div id="writing-qna-log"></div>
      <form id="writing-qna-form">
        <textarea id="writing-qna-input" rows="2" placeholder="왜 이렇게 고쳐졌는지, 다른 표현은 없는지 물어보세요..."></textarea>
        <div class="row-end"><button class="btn-secondary" type="submit">질문하기</button></div>
      </form>
    </div>
    <div class="row-end"><button class="btn-secondary" id="writing-next">다음 질문 →</button></div>`;
}
