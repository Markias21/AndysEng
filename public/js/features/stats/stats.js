// 학습 통계 도메인 로직. 순수 함수만 — 프레임워크/저장소/UI를 import하지 않는다.

/** 최근 n개 점수의 평균. 점수가 없으면 null. */
export function avgLastN(scores, n) {
  if (!Number.isInteger(n) || n <= 0) throw new Error("n은 1 이상의 정수여야 합니다.");
  const slice = scores.slice(-n);
  if (slice.length === 0) return null;
  const sum = slice.reduce((acc, s) => acc + s, 0);
  return Math.round((sum / slice.length) * 10) / 10;
}

/**
 * 기능 하나의 학습 기록 요약.
 * records: [{ts, score, ...}] (시간순)
 */
export function summarize(records) {
  const scores = records.map((r) => r.score);
  return {
    count: records.length,
    avg10: avgLastN(scores, 10),
    avg100: avgLastN(scores, 100),
    recentScores: scores.slice(-10),
  };
}

/** ISO 타임스탬프를 서울 기준 날짜 문자열(YYYY-MM-DD)로. */
export function toSeoulDate(ts) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(ts));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * 일별 학습 통계. records: {conversation, writing, expression, quiz, sessions}.
 * 반환: 날짜 오름차순 [{date, topics, spoken, written, quizCount, quizCorrect, avgScore}]
 * - topics: 그날 다룬 주제 수 = 회화 세션 + 글쓰기 편수 + 표현 개수
 * - spoken: 회화에서 말한 문장 수, written: 글쓰기+표현에서 쓴 문장 수
 * - avgScore: 점수가 있는 기록(회화/글쓰기/표현) 전체 평균
 */
export function dailyStats(records) {
  const days = new Map();
  const day = (ts) => {
    const key = toSeoulDate(ts);
    if (!days.has(key)) {
      days.set(key, {
        date: key,
        topics: 0,
        spoken: 0,
        written: 0,
        quizCount: 0,
        quizCorrect: 0,
        scoreSum: 0,
        scoreCount: 0,
        // 기능별 점수 합/개수 (달력에서 그날의 회화/글쓰기/표현 평균을 보여주기 위해)
        conv: { sum: 0, count: 0 },
        write: { sum: 0, count: 0 },
        expr: { sum: 0, count: 0 },
      });
    }
    return days.get(key);
  };

  const addScore = (d, bucket, score) => {
    d.scoreSum += score;
    d.scoreCount += 1;
    d[bucket].sum += score;
    d[bucket].count += 1;
  };

  for (const r of records.sessions || []) day(r.ts).topics += 1;
  for (const r of records.conversation || []) {
    const d = day(r.ts);
    d.spoken += 1;
    addScore(d, "conv", r.score);
  }
  for (const r of records.writing || []) {
    const d = day(r.ts);
    d.topics += 1;
    d.written += 1;
    addScore(d, "write", r.score);
  }
  for (const r of records.expression || []) {
    const d = day(r.ts);
    d.topics += 1;
    d.written += 1;
    addScore(d, "expr", r.score);
  }
  for (const r of records.quiz || []) {
    const d = day(r.ts);
    d.quizCount += 1;
    if (r.correct) d.quizCorrect += 1;
  }

  const bucketAvg = (b) => (b.count ? round1(b.sum / b.count) : null);
  return [...days.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(({ scoreSum, scoreCount, conv, write, expr, ...rest }) => ({
      ...rest,
      avgScore: scoreCount ? round1(scoreSum / scoreCount) : null,
      convAvg: bucketAvg(conv),
      writeAvg: bucketAvg(write),
      exprAvg: bucketAvg(expr),
    }));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * 월별 달력 격자를 만든다. daily는 dailyStats()의 결과, month는 1~12.
 * 반환: { year, month, weeks: [[cell,...7], ...] }
 * cell(빈칸): { date: null }
 * cell(날짜): { date, day, avgScore, convAvg, writeAvg, exprAvg, hasStudy }
 */
export function calendarMonth(daily, year, month) {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=일 … 6=토

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null });
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date = `${year}-${pad2(month)}-${pad2(dayNum)}`;
    const d = byDate.get(date);
    cells.push({
      date,
      day: dayNum,
      avgScore: d?.avgScore ?? null,
      convAvg: d?.convAvg ?? null,
      writeAvg: d?.writeAvg ?? null,
      exprAvg: d?.exprAvg ?? null,
      hasStudy: !!d && (d.spoken + d.written + d.quizCount > 0 || d.topics > 0),
    });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, weeks };
}

function prevDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 연속 학습 일수. dates: 학습한 날짜 문자열들, today: 오늘 날짜 문자열.
 * 오늘 학습이 없으면 어제까지의 연속을 센다.
 */
export function streak(dates, today) {
  const set = new Set(dates);
  let cursor = set.has(today) ? today : prevDate(today);
  let count = 0;
  while (set.has(cursor)) {
    count += 1;
    cursor = prevDate(cursor);
  }
  return count;
}
