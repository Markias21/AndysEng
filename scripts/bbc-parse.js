// BBC Learning English "6 Minute English" 목록·에피소드 페이지 파싱. 순수 함수만 —
// 네트워크·파일시스템을 건드리지 않아 테스트할 수 있다.
//
// VOA(퍼블릭 도메인)와 달리 BBC 대본은 저작물이라 여기서는 **텍스트를 전혀 뽑지 않는다**.
// 뽑는 것은 오디오·대본 PDF의 링크뿐이고, 대본은 앱이 열 때 브라우저가 BBC에서 직접 받아 파싱한다
// (downloads.bbc.co.uk는 access-control-allow-origin: * 이라 브라우저가 읽을 수 있다).
// 에피소드 HTML 페이지만 CORS 헤더를 주지 않아, 링크를 긁는 이 단계만 Node에서 돈다.

export const LIST_URL = "https://www.bbc.co.uk/learningenglish/english/features/6-minute-english";
const BASE = "https://www.bbc.co.uk";

// 목록 페이지에는 다른 시리즈로 가는 링크도 섞여 있어, 6 Minute English 에피소드 경로만 받는다.
const EPISODE_PATH = /^\/learningenglish\/english\/features\/6-minute-english_20\d\d\/ep-(\d{6})$/;
// 목록 항목은 <h2><a href="...">제목</a></h2>. BBC 마크업은 `<a  href=`처럼 공백이 겹칠 때가 있다.
const LIST_ITEM = /<h2>\s*<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi;

function decodeEntities(s) {
  // BBC 제목은 곧은 따옴표 대신 인쇄용 문자를 쓴다(&rsquo; &ndash; 등). 풀지 않으면 목록에 그대로 노출된다.
  const named = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…",
  };
  return String(s ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}

function stripTags(html) {
  return decodeEntities(String(html ?? "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** 에피소드 id(YYMMDD)를 ISO 날짜로. 6 Minute English는 2015년부터라 20xx로 고정해도 안전하다. */
export function dateOf(id) {
  const m = String(id ?? "").match(/^(\d{2})(\d{2})(\d{2})$/);
  return m ? `20${m[1]}-${m[2]}-${m[3]}` : null;
}

/** 목록 페이지 HTML에서 에피소드를 뽑는다. [{id, title, pageUrl, date}] — 최신순. */
export function parseEpisodeList(html) {
  const seen = new Set();
  const episodes = [];
  for (const m of String(html ?? "").matchAll(LIST_ITEM)) {
    const path = m[1].match(EPISODE_PATH);
    const title = stripTags(m[2]);
    if (!path || !title || seen.has(path[1])) continue;
    seen.add(path[1]);
    episodes.push({ id: path[1], title, pageUrl: `${BASE}${m[1]}`, date: dateOf(path[1]) });
  }
  return episodes;
}

// 자산은 전부 downloads.bbc.co.uk/…/6min/ 에 있다. 파일명 규칙은 회차마다 제멋대로라
// (`_download.mp3` / `_download_.mp3` / 접미사 없음, `_transcript.pdf` / `_transcript_.pdf`,
// 제목의 아포스트로피가 URL에 그대로 남기도 함) 확장자와 `transcript` 유무로만 가른다.
// 문자 클래스에서 `'`를 빼면 안 된다 — 아포스트로피가 든 URL이 중간에 잘린다(실측 사례 있음).
const ASSET = /https:\/\/downloads\.bbc\.co\.uk\/[^"<>\s]*\/6min\/[^"<>\s]*\.(?:mp3|pdf)/gi;

/** 같은 폴더에 다른 회차 파일이 섞여 있을 수 있어, 파일명이 이 에피소드 id로 시작하는 것을 우선한다. */
function pick(urls, id, keep) {
  const mine = id ? urls.filter((u) => u.split("/").pop().startsWith(id)) : [];
  return (mine.length ? mine : urls).find(keep) ?? null;
}

/**
 * 에피소드 페이지 HTML에서 오디오·대본 링크를 뽑는다. {audioUrl, transcriptUrl} — 없으면 null.
 * 링크는 제목·날짜로 추측할 수 없다(실측: 최근 12편 중 3편이 규칙에서 벗어났다).
 */
export function parseEpisodeAssets(html, id) {
  const urls = [...new Set(String(html ?? "").match(ASSET) ?? [])];
  return {
    audioUrl: pick(urls, id, (u) => u.toLowerCase().endsWith(".mp3")),
    // 워크시트 PDF도 같은 폴더에 있으므로 파일명으로 구분한다.
    transcriptUrl: pick(urls, id, (u) => /transcript[^/]*\.pdf$/i.test(u)),
  };
}
