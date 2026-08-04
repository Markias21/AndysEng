// 대본 확보 경계: BBC에서 대본 PDF를 받아 텍스트로 풀고, 이 브라우저에만 캐시한다.
//
// 왜 브라우저가 직접 받는가: BBC 대본은 저작물이라 레포에 담아 공개 재배포할 수 없다. 다행히
// downloads.bbc.co.uk는 access-control-allow-origin: * 이라 브라우저가 직접 읽을 수 있다
// (CORS를 안 주는 곳은 에피소드 HTML 페이지뿐이고, 그건 GitHub Actions가 링크만 긁는다).
//
// 캐시를 store.js가 아니라 별도 localStorage 키에 두는 이유: store는 GitHub 백업·동기화 페이로드에
// 통째로 실린다. 개인 학습 기록과 달리 BBC 대본은 거기에 얹지 않는다.
import { pdfPages } from "../../shared/pdf-text.js";
import { parseTranscript } from "./transcript.js";

const CACHE_KEY = "andyseng:6min-cache";
// 에피소드 하나가 6~8KB다. localStorage를 대본으로 채우지 않도록 최근 것만 남긴다.
const CACHE_LIMIT = 12;

function readCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  const ids = Object.keys(cache);
  const trimmed = ids.length <= CACHE_LIMIT ? cache : Object.fromEntries(ids.slice(-CACHE_LIMIT).map((id) => [id, cache[id]]));
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // 용량이 찼으면 캐시를 포기한다 — 다음에 다시 받으면 되고, 학습 기록을 밀어내면 안 된다.
    localStorage.removeItem(CACHE_KEY);
  }
}

/**
 * 에피소드의 대본을 확보한다. {turns, vocabulary, words}
 * 캐시에 있으면 네트워크·파싱 없이 바로 준다.
 */
export async function loadTranscript(episode) {
  const cache = readCache();
  if (cache[episode.id]) return cache[episode.id];

  const res = await fetch(episode.transcriptUrl);
  if (!res.ok) throw new Error(`BBC에서 대본을 받지 못했습니다 (${res.status})`);
  const pages = await pdfPages(await res.arrayBuffer());
  const transcript = parseTranscript(
    pages.flatMap((p) => p.lines),
    episode.title
  );
  if (!transcript.turns.length) throw new Error("대본을 읽었지만 대사를 찾지 못했습니다.");

  // 같은 키를 다시 넣어도 순서가 유지되므로, 오래된 것부터 밀려나도록 지웠다가 넣는다.
  delete cache[episode.id];
  cache[episode.id] = transcript;
  writeCache(cache);
  return transcript;
}
