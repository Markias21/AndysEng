// 리스닝 연습 화면: 오디오(BBC 스트리밍) + 구간별 받아쓰기 + BBC 어휘 + 토플식 이해 문제.
//
// 오디오는 BBC 링크로 그대로 재생한다(재호스팅하지 않는다). 대본에는 타임스탬프가 없어서
// 구간 시작 시각은 단어 위치로 비례 추정하고, 어긋나면 ±5초 버튼으로 보정한다.
import { DEFAULT_DIFFICULTY, DIFFICULTIES, findDifficulty } from "../../shared/dictation.js";
import { $, esc, expressionAddHTML, wireExpressionAdds } from "../../shared/dom.js";
import { appendRecord, getProfile, setProfile } from "../../shared/store.js";
import { mountDictation } from "./dictation-ui.js";
import { openQuiz } from "./quiz-ui.js";
import { buildSegments, formatClock, startSecOf } from "./segments.js";
import { exampleFor } from "./transcript.js";

const ROOT = "#sixmin-content";
const SPEEDS = [0.75, 1];

const audio = () => $("#sixmin-audio");

function headerHTML(episode) {
  const speeds = SPEEDS.map((s) => `<button class="btn-chip" type="button" data-speed="${s}">${s}x</button>`).join("");
  return `<article class="card">
      <h3>${esc(episode.title)}</h3>
      <p class="small muted">BBC 6 Minute English · ${esc(episode.date)} ·
        <a href="${esc(episode.pageUrl)}" target="_blank" rel="noopener">BBC에서 보기</a></p>
      <audio id="sixmin-audio" controls preload="metadata" class="audio-player" src="${esc(episode.audioUrl)}"></audio>
      <div class="row-audio">
        <span class="small muted">재생 속도</span>${speeds}
        <button class="btn-chip" type="button" data-seek="-5">⏪ 5초</button>
        <button class="btn-chip" type="button" data-seek="5">⏩ 5초</button>
      </div>
    </article>`;
}

function vocabularyHTML(transcript) {
  if (!transcript.vocabulary.length) return "";
  return `<details class="rubric-guide" id="sixmin-vocab">
      <summary>📗 이 회차의 어휘 ${transcript.vocabulary.length}개 (BBC 제공) — 받아쓰기 전에 열면 답이 보여요</summary>
      <p class="small muted">뜻은 BBC가 준 영어 정의 그대로예요. 한국어 뜻이 필요하면 📖 사전으로 찾아보세요.</p>
      ${expressionAddHTML(
        transcript.vocabulary.map((v) => ({
          expression: v.word,
          meaning: v.definition,
          example: exampleFor(transcript.turns, v.word),
        }))
      )}
    </details>`;
}

function segmentChipsHTML(segments, totalWords, duration, current) {
  return segments
    .map(
      (s, i) =>
        `<button class="btn-chip${i === current ? " active" : ""}" type="button" data-segment="${i}">
          ${i + 1}<span class="small muted"> ${formatClock(startSecOf(s, totalWords, duration))}</span>
        </button>`
    )
    .join("");
}

/** 현재 구간 자리로 오디오를 옮긴다. 대본에 타임스탬프가 없어 어림값이다(화면에도 그렇게 적었다). */
function seekToSegment(segment, totalWords) {
  const el = audio();
  if (!el || !Number.isFinite(el.duration)) return;
  el.currentTime = startSecOf(segment, totalWords, el.duration);
  el.play().catch(() => {}); // 자동재생이 막혀 있으면 위치만 옮긴 채로 둔다.
}

export async function startPractice(episode, transcript, context) {
  const segments = buildSegments(transcript.turns);
  const difficulty = findDifficulty(getProfile().listenDifficulty)?.id || DEFAULT_DIFFICULTY;
  let current = 0;

  $(ROOT).innerHTML = `
    <div class="room-toolbar">
      <button class="btn-text" id="sixmin-back" type="button">← 목록</button>
      <span class="toolbar-actions">
        <button class="btn-secondary btn-chip dict-open-btn" type="button">📖 사전</button>
        <button class="btn-secondary btn-chip translate-open-btn" type="button" data-feature="reading">🌐 번역기</button>
      </span>
    </div>
    ${headerHTML(episode)}

    <h3 class="section-title">✍️ 구간 받아쓰기</h3>
    <div class="diff-picker" id="sixmin-diff"></div>
    <p class="small muted" id="sixmin-diff-desc"></p>
    <div class="segment-picker" id="sixmin-segments"></div>
    <p class="small muted">구간 번호 옆 시각은 <b>추정치</b>예요 — 대본에 시간 정보가 없어 말한 분량으로 계산해요.
      어긋나면 ⏪⏩로 맞추세요.</p>
    <div id="sixmin-dictation"></div>

    ${vocabularyHTML(transcript)}

    <h3 class="section-title">❓ 이해 문제</h3>
    <div id="sixmin-quiz"><button class="btn-primary" id="sixmin-quiz-open" type="button">토플식 문제 풀기</button>
      <p class="small muted">이 에피소드의 문제를 처음 만들 때만 AI를 써요(약 $0.03, 확인 후에만). 그다음부터는 몇 번을 풀어도 0원이에요.</p></div>`;

  const root = $(ROOT);
  const totalWords = transcript.words;

  const paintSegments = () => {
    $("#sixmin-segments").innerHTML = segmentChipsHTML(segments, totalWords, audio()?.duration, current);
    root.querySelectorAll("[data-segment]").forEach((btn) =>
      btn.addEventListener("click", () => {
        current = Number(btn.dataset.segment);
        paintSegments();
        seekToSegment(segments[current], totalWords);
        mountSegment();
      })
    );
  };

  const mountSegment = () => {
    mountDictation(segments[current], difficulty, {
      hasNext: current < segments.length - 1,
      onNext: () => {
        current += 1;
        paintSegments();
        seekToSegment(segments[current], totalWords);
        mountSegment();
      },
      onGraded: ({ total, correct }) =>
        appendRecord("sixMin", { episodeId: episode.id, kind: "dictation", difficulty, total, correct }),
    });
  };

  const paintDifficulty = () => {
    $("#sixmin-diff").innerHTML = DIFFICULTIES.map(
      (d) => `<button class="btn-chip${d.id === difficulty ? " active" : ""}" type="button" data-diff="${d.id}">${esc(d.label)}</button>`
    ).join("");
    $("#sixmin-diff-desc").textContent = findDifficulty(difficulty).ko;
    root.querySelectorAll("[data-diff]").forEach((btn) =>
      btn.addEventListener("click", () => {
        setProfile({ listenDifficulty: btn.dataset.diff });
        startPractice(episode, transcript, context);
      })
    );
  };

  $("#sixmin-back").addEventListener("click", context.onBackToList);
  root.querySelectorAll("[data-speed]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (audio()) audio().playbackRate = Number(btn.dataset.speed);
      root.querySelectorAll("[data-speed]").forEach((b) => b.classList.toggle("active", b === btn));
    })
  );
  root.querySelectorAll("[data-seek]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (audio()) audio().currentTime = Math.max(0, audio().currentTime + Number(btn.dataset.seek));
    })
  );
  // 길이를 알아야 구간 시각을 쓸 수 있다. 메타데이터가 도착하면 칩을 다시 그린다.
  audio()?.addEventListener("loadedmetadata", paintSegments);

  if (transcript.vocabulary.length) {
    wireExpressionAdds(
      $("#sixmin-vocab"),
      transcript.vocabulary.map((v) => ({
        expression: v.word,
        meaning: v.definition,
        example: exampleFor(transcript.turns, v.word),
      })),
      `sixmin:${episode.id}`
    );
  }

  $("#sixmin-quiz-open").addEventListener("click", () =>
    openQuiz(episode, transcript, {
      onCancel: () => startPractice(episode, transcript, context),
      onGraded: (summary) =>
        appendRecord("sixMin", { episodeId: episode.id, kind: "quiz", total: summary.total, correct: summary.correct }),
    })
  );

  paintDifficulty();
  paintSegments();
  mountSegment();
}
