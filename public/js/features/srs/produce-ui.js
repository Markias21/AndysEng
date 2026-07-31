// 복습의 '예문 만들기' 화면(선택 단계): 표현/단어로 내 이야기를 쓰면 AI가 첨삭한다.
// 첨삭은 피드백 전용이다 — 다음 복습 시점은 이 화면이 아니라 앞선 빈칸 정답 여부가 정한다.
import { REVIEW_SCHEMA, reviewSystem } from "./schema.js";
import { nounFor, withParticle } from "./labels.js";
import { chatJSON } from "../../shared/claude.js";
import { scoreDetail } from "../../shared/scoring.js";
import { $, esc, toast, scoreBreakdownHTML, correctionsHTML, spellingHTML } from "../../shared/dom.js";

/**
 * item: {kind, term}
 * onDone(score): 첨삭을 확인하고 다음으로 넘어갈 때
 */
export function renderProduce(item, onDone) {
  const noun = nounFor(item.kind);
  $("#srs-content").innerHTML = `
    <div class="card">
      <span class="chip chip-yellow">이 ${withParticle(noun, "으로", "로")} 내 이야기 만들기</span>
      <h3 class="expr-word">${esc(item.term)}</h3>
      <p class="reason">아무 예문보다 <b>실제 내 경험·습관·계획</b>을 담은 문장이 훨씬 오래 남아요.</p>
    </div>
    <form id="srs-form">
      <textarea id="srs-input" rows="3" placeholder="이 ${withParticle(noun, "을", "를")} 써서 나에 대한 문장을 만들어 보세요..."></textarea>
      <div class="row-end">
        <button class="btn-primary" type="submit">채점 받기</button>
      </div>
    </form>
    <div id="srs-result"></div>`;
  $("#srs-input").focus();
  $("#srs-form").addEventListener("submit", (ev) => onSubmit(ev, item, onDone));
}

async function grade(item, sentence) {
  return chatJSON({
    system: reviewSystem(item.kind, item.term),
    messages: [{ role: "user", content: `Learner's sentence: "${sentence}"` }],
    schema: REVIEW_SCHEMA,
  });
}

async function onSubmit(ev, item, onDone) {
  ev.preventDefault();
  const sentence = $("#srs-input").value.trim();
  if (!sentence) return toast("예문을 먼저 작성해 주세요.");
  const btn = ev.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "채점 중...";
  try {
    const result = await grade(item, sentence);
    const score = scoreDetail("expression", result.grades).total;
    $("#srs-input").disabled = true;
    btn.classList.add("hidden");

    $("#srs-result").innerHTML = `
      <div class="feedback ${result.corrections.length ? "" : "good"}">
        <div class="fb-title">📝 첨삭</div>
        ${scoreBreakdownHTML("expression", result.grades)}
        ${result.spelling?.length ? `<div class="fb-title">✏️ 오타·대소문자 <span class="reason">(점수에는 반영하지 않아요)</span></div>${spellingHTML(result.spelling)}` : ""}
        ${correctionsHTML(result.corrections)}
        <div>💬 원어민이라면: <span class="fixed">${esc(result.natural_version)}</span></div>
        <div class="reason mt-6">${esc(result.comment)}</div>
      </div>
      <div class="row-end"><button class="btn-primary" id="srs-next" type="button">다음 →</button></div>`;

    $("#srs-next").addEventListener("click", () => onDone(score));
  } catch (e) {
    toast(e.message);
    btn.disabled = false;
    btn.textContent = "채점 받기";
  }
}
