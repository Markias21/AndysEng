// 학습 리포트 도메인 로직. 순수 함수만 — 프레임워크/파일시스템/저장소를 import하지 않는다.

/** 점수 배열의 평균(반올림). 없으면 null. */
function avg(scores) {
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, s) => a + s, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

function conversationSection(records) {
  if (records.length === 0) return [];
  const lines = [`## 💬 회화 (${records.length}문장, 평균 ${avg(records.map((r) => r.score))}점)`, ""];
  for (const r of records) {
    lines.push(`- (${r.score}점) ${r.sentence}`);
  }
  lines.push("");
  return lines;
}

/** 문장 단위 답안([{sentence, translation}])을 리포트용 여러 줄 텍스트로 편다. 밑줄 마커는 뺀다. */
function answerLines(value) {
  if (!value) return [];
  const sentences = typeof value === "string" ? [{ sentence: value }] : value;
  return sentences.flatMap((s) => {
    const en = s.sentence.replace(/\[\[|\]\]/g, "");
    return s.translation ? [en, `> ${s.translation}`, ""] : [en, ""];
  });
}

function writingSection(records) {
  if (records.length === 0) return [];
  const lines = [`## ✍️ 글쓰기 (${records.length}편, 평균 ${avg(records.map((r) => r.score))}점)`, ""];
  for (const r of records) {
    lines.push(`### (${r.score}점) ${r.question}`, "");
    lines.push(`**내 답안**`, "", r.answer, "");
    if (r.feedback?.corrected_answer) lines.push(`**교정된 답안**`, "", ...answerLines(r.feedback.corrected_answer));
    if (r.feedback?.native_answer) lines.push(`**원어민 모범 답안**`, "", ...answerLines(r.feedback.native_answer));
    const exprs = r.feedback?.native_expressions || [];
    if (exprs.length) {
      lines.push(`**익혀둘 표현**`, "");
      for (const e of exprs) lines.push(`- **${e.expression}** — ${e.meaning}`);
      lines.push("");
    }
  }
  return lines;
}

function expressionSection(records) {
  if (records.length === 0) return [];
  const lines = [`## 💡 표현 (${records.length}개, 평균 ${avg(records.map((r) => r.score))}점)`, ""];
  for (const r of records) {
    lines.push(`- **${r.expression}** (${r.score}점): ${r.sentence}`);
  }
  lines.push("");
  return lines;
}

function quizSection(records) {
  if (records.length === 0) return [];
  const correct = records.filter((r) => r.correct).length;
  const rate = Math.round((correct / records.length) * 100);
  const lines = [`## 🔁 복습 퀴즈 (${records.length}문제, 정답률 ${rate}%)`, ""];
  for (const r of records) {
    lines.push(`- ${r.correct ? "✅" : "❌"} ${r.expression}`);
  }
  lines.push("");
  return lines;
}

/**
 * 한 세션의 학습 기록을 마크다운 리포트로 만든다.
 * records: { conversation, writing, expression, quiz } (각각 배열)
 * meta: { dateLabel, userName? }
 */
export function buildReport(records, meta) {
  const { conversation = [], writing = [], expression = [], quiz = [] } = records;
  const total = conversation.length + writing.length + expression.length;
  const lines = [`# AndysEng 학습 리포트 — ${meta.dateLabel}`, ""];
  if (meta.userName) lines.push(`- 학습자: ${meta.userName}`);
  lines.push(`- 학습한 문장 수: ${total}개`, "");
  lines.push(...conversationSection(conversation));
  lines.push(...writingSection(writing));
  lines.push(...expressionSection(expression));
  lines.push(...quizSection(quiz));
  return lines.join("\n").replace(/\n+$/, "\n");
}

/**
 * 리포트 파일 이름을 정한다. 그 날짜의 첫 리포트는 `YYYY-MM-DD.md`,
 * 2번째부터 `YYYY-MM-DD-2.md`, `-3` … 로 번호를 붙인다.
 * existingNames: 해당 폴더에 이미 있는 파일 이름들.
 */
export function nextReportName(dateStr, existingNames) {
  const re = new RegExp(`^${dateStr}(?:-(\\d+))?\\.md$`);
  let max = 0;
  for (const name of existingNames) {
    const m = name.match(re);
    if (!m) continue;
    const idx = m[1] ? parseInt(m[1], 10) : 1;
    if (idx > max) max = idx;
  }
  const next = max + 1;
  return next === 1 ? `${dateStr}.md` : `${dateStr}-${next}.md`;
}
