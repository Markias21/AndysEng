// VOA RSS·기사 HTML 파싱. 순수 함수만 — 네트워크·파일시스템을 건드리지 않아 테스트할 수 있다.
//
// VOA Learning English는 전체 콘텐츠가 퍼블릭 도메인이라 본문을 저장·가공해도 저작권 문제가 없다.
// 다만 RSS·기사 서버가 CORS 헤더를 주지 않아 브라우저에서 직접 못 읽는다. 그래서 이 파싱을
// GitHub Actions(Node)에서 돌려 결과 JSON을 리포에 커밋하고, 앱은 그것을 same-origin으로 읽는다.

// 토플 리딩과 주제가 겹치는 피드만 고른다(학술·시사). 회화 교재성 시리즈(문법 강좌, 발음, 레벨별 수업)는 제외.
// feed 값은 VOA의 불투명한 피드 id다. 피드 목록 페이지의 라벨은 한 칸씩 밀려 있어 믿을 수 없으니,
// 바꿀 일이 생기면 반드시 해당 피드를 직접 받아 <channel><title>로 확인할 것.
export const CATEGORIES = [
  { id: "science", label: "🔬 과학·기술", feed: "zmg_pl-vomx-tpeymtm" },
  { id: "health", label: "🩺 건강·생활", feed: "zmmpql-vomx-tpey-_q" },
  { id: "education", label: "🎓 교육", feed: "ztmp_l-vomx-tpek-__" },
  { id: "history", label: "🏛 미국 역사", feed: "zj_pvl-vomx-tpebb_v" },
  { id: "arts", label: "🎨 예술·문화", feed: "zpyp_l-vomx-tpe_rym" },
  { id: "society", label: "🌏 시사·사회", feed: "zkm-ql-vomx-tpej-rqi" },
  // "America's Presidents" 피드는 넣지 않는다 — 같은 기사가 U.S. History 피드에도 실려 전부 중복이었다.
];

export function findCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

const BASE = "https://learningenglish.voanews.com";

export const feedUrl = (category) => `${BASE}/api/${category.feed}`;

function decodeEntities(s) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}

/** 태그를 걷어내고 엔티티를 푼 뒤 공백을 정리한다. */
function stripTags(html) {
  return decodeEntities(String(html ?? "").replace(/<[^>]+>/g, " "))
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const tagText = (item, tag) => {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")).trim() : "";
};

/** 기사 URL 끝의 숫자가 VOA의 안정적인 기사 id다. 없으면 null(건너뛴다). */
export function articleId(link) {
  const m = String(link ?? "").match(/(\d{5,})\.html/);
  return m ? m[1] : null;
}

/** RSS XML에서 기사 항목을 뽑는다. [{id, title, link, pubDate}] */
export function parseFeed(xml) {
  return [...String(xml ?? "").matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((m) => {
      const item = m[1];
      const link = tagText(item, "link");
      return { id: articleId(link), title: stripTags(tagText(item, "title")), link, pubDate: tagText(item, "pubDate") };
    })
    .filter((a) => a.id && a.title && a.link);
}

// 본문 문단은 class 없는 <p>다. 공유/인쇄/댓글 버튼과 플레이어 자리표시자는 전부 class를 달고 있어
// 이 한 가지 규칙으로 잡동사니가 걸러진다.
const PLAIN_P = /<p>([\s\S]*?)<\/p>/gi;
// 소제목은 문단 전체가 <strong>으로만 감싸인 <p>다.
const HEADING = /^<strong>[\s\S]*<\/strong>$/i;
// 본문과 어휘 풀이를 가르는 밑줄 줄.
const DIVIDER = /^_{5,}$/;
// 본문 끝의 진행자 사인오프·출처 표기. 학습용 지문에는 필요 없다.
const SIGNOFF = /^(I'm |And I'm )|adapted (it|this story) for VOA|reported (on )?this story|wrote this story for/i;
// 어휘 풀이 줄: "insurance – n. an agreement ..." (품사는 약어 하나로 끊는다)
const GLOSS = /^(.+?)\s*[–-]\s*((?:n|v|adj|adv|prep|conj|phr)\.)\s*(.+)$/i;

function classify(inner) {
  const text = stripTags(inner);
  if (!text) return null;
  if (DIVIDER.test(text)) return { kind: "divider" };
  if (HEADING.test(inner.trim())) return { kind: "heading", text };
  return { kind: "para", text };
}

/**
 * 기사 HTML에서 본문 문단과 VOA가 붙여 주는 어휘 풀이를 뽑는다.
 * 반환: { paragraphs: [{type:"heading"|"para", text}], glossary: [{word, pos, meaning}], audio }
 */
export function parseArticle(html) {
  const source = String(html ?? "");
  const start = source.indexOf('<div class="wsw">');
  const body = start < 0 ? "" : source.slice(start);

  const paragraphs = [];
  const glossary = [];
  let inGlossary = false;

  for (const m of body.matchAll(PLAIN_P)) {
    const block = classify(m[1]);
    if (!block) continue;
    if (block.kind === "divider") {
      inGlossary = true;
      continue;
    }
    if (inGlossary) {
      const g = block.text.match(GLOSS);
      if (g) glossary.push({ word: g[1].trim(), pos: g[2].trim().replace(/\.$/, ""), meaning: g[3].trim() });
      continue;
    }
    if (SIGNOFF.test(block.text)) continue;
    paragraphs.push({ type: block.kind === "heading" ? "heading" : "para", text: block.text });
  }

  const audio = source.match(/https:\/\/voa-audio[^"']+\.mp3/)?.[0] ?? null;
  return { paragraphs, glossary, audio };
}

/** 지문 분량(본문 단어 수). 목록에서 예상 시간을 보여 주고 너무 짧은 기사를 거르는 데 쓴다. */
export function wordCount(paragraphs) {
  return paragraphs
    .filter((p) => p.type === "para")
    .reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
}
