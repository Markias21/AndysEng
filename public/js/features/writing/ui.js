// 글쓰기 공부: 로컬 질문 제시 → 유저가 3~4문장 논설문 작성 → 문법 첨삭 + 교정문 + 원어민 답안 + 표현 제시.
// 질문은 로컬 데이터에서 뽑아 토큰을 아끼고, AI 호출은 첨삭에만 쓴다. 첨삭에서 나온 표현들은 복습 덱에 자동으로 쌓인다.
import { chatJSON } from "../../shared/claude.js";
import { appendRecord, getRecords, getProfile } from "../../shared/store.js";
import { pickFresh, sampleN } from "../../shared/pick.js";
import { scoreDetail, GRADE_SCALE_NOTE, GRAMMAR_RUBRIC, NATURALNESS_NOTE, TASK_RUBRIC, RANGE_RUBRIC } from "../../shared/scoring.js";
import { WRITING_TIPS, CEFR_WRITING_DESCRIPTORS, descriptorBlock } from "../../shared/levels.js";
import { autoSaveToGithub } from "../../shared/autosave.js";
import { takeTranslatorUses, TRANSLATOR_PENALTY } from "../../shared/translate.js";
import { writingPrompts } from "./prompts.js";
import { toeflPromptBlock, toeflBand } from "./toefl.js";
import { structureTemplateHTML, structureExpressions } from "./structure.js";
import { REVIEW_SCHEMA } from "./schema.js";
import { startQna, resetQna, askQna, qnaLogHTML } from "./qna.js";
import { mountCloze } from "./cloze-ui.js";
import {
  $, esc, toast, scoreBreakdownHTML, rubricGuideHTML, correctionsHTML,
  spellingHTML, sentenceLinesHTML, expressionAddHTML, wireExpressionAdds,
  translatorPenaltyHTML,
} from "../../shared/dom.js";

// 구조 제시 패널에서 한 번에 보여 줄 표현 개수.
const STRUCTURE_EXPR_COUNT = 5;

// 최근 이 개수만큼의 질문은 다시 나오지 않게 피한다.
const RECENT_PROMPTS = 20;

function recentQuestions() {
  return getRecords("writing")
    .slice(-RECENT_PROMPTS)
    .map((r) => r.question);
}

function showTip() {
  const level = getProfile().level;
  const el = $("#writing-tip");
  if (el) el.innerHTML = `<b>${esc(level)} 목표:</b> ${esc(WRITING_TIPS[level] || WRITING_TIPS.B1)}`;
}

function newQuestion() {
  const question = pickFresh(writingPrompts, recentQuestions());
  if (!question) return toast("글쓰기 질문을 불러오지 못했습니다.");
  takeTranslatorUses("writing"); // 이전 질문에서 남은 번역기 사용 기록은 새 질문으로 넘기지 않는다.
  resetQna();
  $("#writing-question").textContent = question;
  showTip();
  $("#writing-input").value = "";
  $("#writing-result").innerHTML = "";
  $("#writing-intro").classList.add("hidden");
  $("#writing-room").classList.remove("hidden");
}

function renderStructureExpressions() {
  const picked = sampleN(structureExpressions, STRUCTURE_EXPR_COUNT);
  const el = $("#structure-exprs");
  el.innerHTML = expressionAddHTML(picked);
  wireExpressionAdds(el, picked, "writing");
}

function toggleStructure() {
  const panel = $("#writing-structure");
  const opening = panel.classList.contains("hidden");
  panel.classList.toggle("hidden");
  if (opening) {
    $("#structure-template").innerHTML = structureTemplateHTML;
    renderStructureExpressions();
  }
}

async function review(question, answer) {
  const level = getProfile().level;
  const result = await chatJSON({
    system: `You are an English writing tutor for a Korean learner whose target level is CEFR ${level}. Pitch your model answer to that level, but grade the rubric on an absolute scale (see below).

1. spelling: list only typos, capitalization, and apostrophe slips, as original -> corrected. No explanation, no reason. Empty array if none.
2. corrections: real grammar errors and awkward phrasing only (never typos, capitalization, or apostrophes), with the reason explained in Korean.
3. corrected_answer: the learner's own answer with only grammatical fixes applied (keep their voice and argument), split into one object per sentence with a Korean translation of that sentence.
4. native_answer: the same argument rewritten as a fluent native speaker would write it (3-4 sentences), split the same way with a Korean translation per sentence. Write it at CEFR ${level} — use vocabulary and sentence patterns the learner at that level can actually reuse, not higher.
5. In both corrected_answer and native_answer, wrap in [[ ]] the parts that fix something the learner got wrong or that introduce an important expression worth noticing. Wrap the phrase itself, not whole sentences, and leave unchanged parts unwrapped.
6. native_expressions: 3-5 useful native-like expressions, each of which MUST appear verbatim somewhere in native_answer (the learner will be asked to recall them from it). Give each a Korean meaning, an example sentence, its CEFR level (A1-C2), and non_literal.
7. cefr_level: the CEFR level (A1-C2) this essay actually demonstrates. Pick the highest level whose writing-skill descriptor the essay fully meets:
${descriptorBlock(CEFR_WRITING_DESCRIPTORS)}
8. toefl_score: score this essay 0-4 with the official TOEFL "Writing for an Academic Discussion" rubric below. Never lower the score for typos, capitalization, or spelling slips (those belong only in "spelling"). Pick the band the essay best matches as a whole:
${toeflPromptBlock()}
9. grades: grade the essay on four independent components, judged separately.
${GRADE_SCALE_NOTE}
- task: ${TASK_RUBRIC}
Here, task means how well the essay addresses the prompt and develops a clear, relevant argument.
- accuracy: ${GRAMMAR_RUBRIC}
- range: ${RANGE_RUBRIC}
- fluency: ${NATURALNESS_NOTE} This is written essay prose, so a formal/written register is the natural fit here. Fluency here also covers how well the sentences are organized and connected (coherence and flow).`,
    messages: [{ role: "user", content: `Prompt: ${question}\n\nLearner's answer:\n${answer}` }],
    schema: REVIEW_SCHEMA,
    maxTokens: 8192,
  });
  const rawTotal = scoreDetail("writing", result.grades).total;
  const translatorUses = takeTranslatorUses("writing");
  const penalty = translatorUses * TRANSLATOR_PENALTY.writing;
  const total = Math.max(0, rawTotal - penalty);
  // 글쓰기는 피드백 전체를 따로 저장한다 (스펙 요구사항).
  appendRecord("writing", { score: total, grades: result.grades, cefr: result.cefr_level, toefl: result.toefl_score, question, answer, feedback: result, translatorUses });
  return { ...result, translatorUses, penalty, total };
}

export function init() {
  $("#writing-rubric").innerHTML = rubricGuideHTML("writing");
  $("#writing-start").addEventListener("click", newQuestion);
  const reroll = $("#writing-reroll");
  if (reroll) reroll.addEventListener("click", newQuestion);
  $("#writing-structure-btn").addEventListener("click", toggleStructure);
  $("#structure-refresh").addEventListener("click", renderStructureExpressions);

  $("#writing-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const answer = $("#writing-input").value.trim();
    if (!answer) return toast("답안을 먼저 작성해 주세요.");
    const btn = ev.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = "첨삭 중...";
    try {
      const r = await review($("#writing-question").textContent, answer);
      startQna({ question: $("#writing-question").textContent, answer, feedback: r });
      const result = $("#writing-result");
      // 원어민 문장을 먼저 인출해 보게 하고, 그 뒤에야 첨삭 전체를 연다.
      // (정답이 corrections/corrected_answer로 새는 것을 막고, 모범 답안을 그냥 넘기지 않게 한다)
      result.innerHTML = `
        <div class="result-section" id="writing-cloze"></div>
        <div class="result-section hidden" id="writing-feedback-rest">
          <h4>🎯 TOEFL 라이팅 <span class="cefr">${r.toefl_score} / 4</span></h4>
          <div class="card">${esc(toeflBand(r.toefl_score).ko)}</div>
          <h4>🏅 점수 <span class="cefr">이 글의 레벨: ${esc(r.cefr_level)}</span></h4>
          <div class="card">${scoreBreakdownHTML("writing", r.grades)}${translatorPenaltyHTML(r.translatorUses, r.penalty, r.total)}</div>
          <h4>📝 문법 첨삭</h4>
          <div class="card">${r.corrections.length ? correctionsHTML(r.corrections) : "✅ 문법 오류가 없어요!"}</div>
          ${r.spelling?.length ? `<h4>✏️ 오타·대소문자 <span class="reason">(점수에는 반영하지 않아요)</span></h4>
          <div class="card">${spellingHTML(r.spelling)}</div>` : ""}
          <h4>✔️ 교정된 답안</h4>
          <div class="card">${sentenceLinesHTML(r.corrected_answer)}</div>
          <h4>🌟 원어민 모범 답안 <span class="cefr">${esc(getProfile().level)}</span></h4>
          <div class="card">${sentenceLinesHTML(r.native_answer)}</div>
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
          <div class="row-end"><button class="btn-secondary" id="writing-next">다음 질문 →</button></div>
        </div>`;
      mountCloze($("#writing-cloze"), r, (missed) => {
        $("#writing-feedback-rest").classList.remove("hidden");
        const exprs = $("#writing-exprs");
        exprs.innerHTML = expressionAddHTML(r.native_expressions, missed);
        wireExpressionAdds(exprs, r.native_expressions, "writing");
      });
      $("#writing-next").addEventListener("click", newQuestion);
      $("#writing-qna-form").addEventListener("submit", async (qev) => {
        qev.preventDefault();
        const input = $("#writing-qna-input");
        const question = input.value.trim();
        if (!question) return;
        const qbtn = qev.target.querySelector("button");
        qbtn.disabled = true;
        qbtn.textContent = "답변 중...";
        try {
          await askQna(question);
          input.value = "";
          $("#writing-qna-log").innerHTML = qnaLogHTML();
        } catch (e) {
          toast(e.message);
        } finally {
          qbtn.disabled = false;
          qbtn.textContent = "질문하기";
        }
      });
      autoSaveToGithub();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "첨삭 받기";
    }
  });
}
