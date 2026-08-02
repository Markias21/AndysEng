// 리딩 채점 결과 화면. 객관식·빈칸은 로컬 채점 결과를 그대로 펼치고,
// 요약·재진술만 AI 채점을 기다린다(둘 다 비었으면 호출 자체를 하지 않는다).
import { appendRecord, getProfile } from "../../shared/store.js";
import { scoreDetail } from "../../shared/scoring.js";
import { autoSaveToGithub } from "../../shared/autosave.js";
import { takeTranslatorUses, TRANSLATOR_PENALTY } from "../../shared/translate.js";
import { blankResultHTML, weaveHTML } from "../../shared/cloze-view.js";
import {
  $, esc, toast, correctionsHTML, expressionAddHTML, gradeBadge, rubricGuideHTML,
  scoreBreakdownHTML, sentenceLinesHTML, spellingHTML, translatorPenaltyHTML, wireExpressionAdds,
} from "../../shared/dom.js";
import { gradeProduction } from "./ai.js";
import { CORRECT, SKIPPED, WRONG, comprehensionSummary, weakTypes } from "./score.js";
import { typeLabel } from "./types.js";

const STATUS_LABEL = { [CORRECT]: "✅ 정답", [WRONG]: "❌ 오답", [SKIPPED]: "⏭ 스킵" };

function minutesLabel(ms) {
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

function choiceResultHTML(q, r, i) {
  const options = q.options
    .map((o, j) => {
      const cls = j === q.answer ? "mc-correct" : j === r.chosen ? "mc-wrong" : "";
      const mark = j === q.answer ? "✔" : j === r.chosen ? "✕" : "";
      return `<li class="${cls}"><span class="mc-mark">${mark}</span>${esc(o)}</li>`;
    })
    .join("");
  return `<div class="card mc-card">
      <div class="mc-head">
        <span class="chip">${i + 1}</span>
        <span class="small muted">${esc(typeLabel(q.type))}</span>
        <span class="mc-status">${STATUS_LABEL[r.status]}</span>
      </div>
      <p class="mc-stem">${esc(q.stem)}</p>
      <ul class="mc-review">${options}</ul>
      <p class="reason">${esc(q.explanation_ko)}</p>
      <p class="mc-evidence">📌 ${esc(q.evidence)}</p>
    </div>`;
}

function clozeResultHTML(items, blankResults, typed) {
  if (!items.length) return "";
  const lines = items
    .map((item, i) => {
      const answer = item.line.blanks[0].answer;
      const body = weaveHTML([item.line], () => blankResultHTML(answer, blankResults[i].wordFlags, typed[i]));
      return `<div class="card cloze-card">${body}<p class="small muted">${STATUS_LABEL[blankResults[i].status]} · ${esc(item.blank.meaning)}</p></div>`;
    })
    .join("");
  return `<h3 class="section-title">🔤 표현 빈칸</h3>${lines}`;
}

function summaryCardHTML({ comprehension, weak, elapsedMs, detail, penalty, finalScore }) {
  const accuracy = comprehension.accuracy === null ? "—" : `${comprehension.accuracy}%`;
  const weakLine = weak.length
    ? `<p class="reason">더 연습할 유형: <b>${weak.map((w) => esc(w.label)).join(", ")}</b></p>`
    : "";
  const produceLine = detail
    ? `<div class="score-overall">${gradeBadge(detail.overall)}<b>${finalScore}점</b><span class="muted small">/ 100 · 요약·재진술</span></div>`
    : `<p class="reason">요약·재진술을 건너뛰어 산출 점수는 없어요.</p>`;
  return `<div class="card result-summary">
      <h3>📊 종합 평가</h3>
      <p><b>이해</b> ${comprehension.correct}/${comprehension.total} 정답 (정답률 ${accuracy})
        ${comprehension.skipped ? ` · 스킵 ${comprehension.skipped}개` : ""}</p>
      ${produceLine}
      ${penalty}
      ${weakLine}
      <p class="small muted">읽고 푸는 데 ${minutesLabel(elapsedMs)} 걸렸어요.</p>
    </div>`;
}

/** 항목 문구는 로컬(key_points)에 있고 AI는 순서대로 covered+comment만 준다. 모자란 자리는 못 담은 것으로 본다. */
function coveredHTML(keyPoints, covered) {
  if (!keyPoints?.length) return "";
  const rows = keyPoints
    .map((point, i) => {
      const c = covered?.[i];
      return `<li class="${c?.covered ? "res-ok" : "res-miss"}">${c?.covered ? "✅" : "❌"} ${esc(point)}${
        c?.comment ? `<br/><span class="reason">${esc(c.comment)}</span>` : ""
      }</li>`;
    })
    .join("");
  return `<h4>🎯 핵심 논지 체크리스트</h4><ul class="covered-list">${rows}</ul>`;
}

function block(title, html) {
  return html ? `<h4>${title}</h4>${html}` : "";
}

function productionHTML(review, keyPoints, penaltyHTML) {
  const inaccuracies = review.inaccuracies?.length
    ? `<ul>${review.inaccuracies.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
    : "";
  return `<h3 class="section-title">✍️ 요약·재진술 첨삭</h3>
    <div class="card">
      ${scoreBreakdownHTML("reading", review.grades)}
      ${penaltyHTML}
      <p class="reason">${esc(review.comment)}</p>
      ${coveredHTML(keyPoints, review.covered)}
      ${block("⚠️ 원문과 다른 내용", inaccuracies)}
      ${block("🛠 문법 교정", correctionsHTML(review.corrections))}
      ${block("✏️ 오타 (점수 미반영)", spellingHTML(review.spelling))}
      ${block("📝 모범 요약", sentenceLinesHTML(review.model_summary))}
      ${block("🔁 모범 재진술", review.model_restatement ? `<p class="answer-line">${esc(review.model_restatement)}</p>` : "")}
    </div>`;
}

/** 못 맞힌 표현이 먼저 눈에 띄게, 담을 것은 유저가 고른다(다른 기능과 동일). */
function expressionsSection(items, blankResults) {
  if (!items.length) return { html: "", list: [], missed: new Set() };
  const list = items.map((item) => ({
    expression: item.blank.expression,
    meaning: item.blank.meaning,
    example: item.blank.sentence,
    example_ko: item.blank.sentence_ko,
    level: item.blank.level,
    non_literal: item.blank.non_literal,
  }));
  const missed = new Set(items.filter((_, i) => blankResults[i].status !== CORRECT).map((it) => it.blank.expression));
  return {
    html: `<h3 class="section-title">💡 이 지문의 표현</h3>
      <p class="small muted">담을 것만 골라 복습에 추가하세요.</p>
      <div class="card" id="reading-exprs"></div>`,
    list,
    missed,
  };
}

export async function showResult(ctx) {
  const { article, set, items, choiceResults, blankResults, typed, summary, restatement, elapsedMs } = ctx;
  const root = $("#reading-content");
  // 번역기 사용 횟수는 결과를 낼 때 반드시 한 번 꺼내 0으로 되돌린다(AI 채점을 건너뛰어도 마찬가지).
  const uses = takeTranslatorUses("reading");
  const graded = Boolean(summary || restatement);

  const questionsHost = $("#reading-questions");
  if (questionsHost) {
    questionsHost.innerHTML = graded
      ? `<p class="muted">요약과 재진술을 채점하고 있어요…</p>`
      : `<p class="muted">채점 중…</p>`;
  }

  let review = null;
  if (graded) {
    try {
      review = await gradeProduction({ set, level: getProfile().level, summary, restatement });
    } catch (e) {
      toast(`요약 채점에 실패했어요: ${e.message}`);
    }
  }

  const comprehension = comprehensionSummary([...choiceResults, ...blankResults]);
  const weak = weakTypes(choiceResults);
  const detail = review ? scoreDetail("reading", review.grades) : null;
  const penalty = uses * TRANSLATOR_PENALTY.reading;
  const finalScore = detail ? Math.max(0, detail.total - penalty) : null;
  const penaltyHTML = detail ? translatorPenaltyHTML(uses, penalty, finalScore) : "";
  const exprs = expressionsSection(items, blankResults);

  root.innerHTML = `
    <div class="room-toolbar">
      <button class="btn-text" id="reading-back" type="button">← 목록</button>
      <span class="toolbar-actions"><button class="btn-secondary btn-chip" id="reading-retry" type="button">🔁 다시 풀기</button></span>
    </div>
    ${summaryCardHTML({ comprehension, weak, elapsedMs, detail, penalty: penaltyHTML, finalScore })}
    <h3 class="section-title">❓ 이해 문제</h3>
    ${set.questions.map((q, i) => choiceResultHTML(q, choiceResults[i], i)).join("")}
    ${clozeResultHTML(items, blankResults, typed)}
    ${review ? productionHTML(review, set.key_points, penaltyHTML) : ""}
    ${exprs.html}
    <div id="reading-rubric">${rubricGuideHTML("reading")}</div>
    <div class="row-end"><button class="btn-primary" id="reading-next" type="button">다른 지문 →</button></div>`;

  if (exprs.list.length) {
    const host = $("#reading-exprs");
    host.innerHTML = expressionAddHTML(exprs.list, exprs.missed);
    wireExpressionAdds(host, exprs.list, "reading");
  }

  appendRecord("reading", {
    articleId: article.id,
    category: article.category,
    title: article.title,
    total: comprehension.total,
    correct: comprehension.correct,
    skipped: comprehension.skipped,
    seconds: Math.round(elapsedMs / 1000),
    // 산출 과제를 건너뛰면 점수가 없다. 통계는 점수가 있는 기록만 센다.
    ...(detail ? { score: finalScore, grades: review.grades } : {}),
  });
  autoSaveToGithub();

  $("#reading-back").addEventListener("click", ctx.onBackToList);
  $("#reading-retry").addEventListener("click", () => ctx.onRetry(article));
  $("#reading-next").addEventListener("click", ctx.onBackToList);
}
