// VOA Learning English 기사를 모아 public/data/reading/ 에 JSON으로 떨어뜨린다.
// GitHub Actions가 매일 돌리고 결과를 커밋한다(→ pages.yml이 배포 → 앱은 same-origin으로 읽음).
// 브라우저에서 직접 못 하는 이유는 VOA가 CORS 헤더를 주지 않기 때문이다.
//
// 실행: node scripts/fetch-voa.js
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { CATEGORIES, feedUrl, parseArticle, parseFeed, wordCount } from "./voa-parse.js";

const OUT_DIR = join(process.cwd(), "public", "data", "reading");
const INDEX_PATH = join(OUT_DIR, "index.json");

// 카테고리마다 이만큼만 유지한다(오래된 것부터 버림). 리포가 무한히 커지지 않게.
const KEEP_PER_CATEGORY = 12;
// 한 번 실행에 카테고리마다 새로 받아올 기사 수 상한. 카테고리별로 나눠야 한 곳에 쏠리지 않는다.
// 처음 채울 때는 SEED=1 환경변수로 넉넉히 받는다.
const MAX_NEW_PER_CATEGORY = process.env.SEED ? KEEP_PER_CATEGORY : 2;
// 토플 리딩 한 지문 분량에 가까운 것만 쓴다. 너무 짧으면 문제가 안 나오고 너무 길면 읽기가 부담스럽다.
const MIN_WORDS = 350;
const MAX_WORDS = 1200;

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "AndysEng/1.0 (personal English study app)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function readIndex() {
  try {
    return JSON.parse(await readFile(INDEX_PATH, "utf8"));
  } catch {
    return { updatedAt: null, articles: [] };
  }
}

/** 기사 하나를 받아 저장한다. 분량이 맞지 않으면 저장하지 않고 null을 반환한다. */
async function fetchArticle(entry, category) {
  const { paragraphs, glossary, audio } = parseArticle(await get(entry.link));
  const words = wordCount(paragraphs);
  if (words < MIN_WORDS || words > MAX_WORDS) return null;

  const article = {
    id: entry.id,
    category: category.id,
    title: entry.title,
    link: entry.link,
    publishedAt: entry.pubDate,
    words,
    paragraphs,
    glossary,
    audio,
  };
  await writeFile(join(OUT_DIR, `${entry.id}.json`), JSON.stringify(article), "utf8");
  return { id: article.id, category: article.category, title: article.title, words, publishedAt: article.publishedAt };
}

/** 카테고리당 KEEP_PER_CATEGORY개만 남기고, 밀려난 기사 파일은 지운다. */
async function prune(articles) {
  const kept = [];
  for (const category of CATEGORIES) {
    const mine = articles.filter((a) => a.category === category.id);
    kept.push(...mine.slice(0, KEEP_PER_CATEGORY));
    for (const dropped of mine.slice(KEEP_PER_CATEGORY)) {
      await rm(join(OUT_DIR, `${dropped.id}.json`), { force: true });
    }
  }
  return kept;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const index = await readIndex();
  const known = new Set(index.articles.map((a) => a.id));
  const added = [];

  for (const category of CATEGORIES) {
    let entries;
    try {
      entries = parseFeed(await get(feedUrl(category)));
    } catch (e) {
      // 피드 하나가 죽어도 나머지는 계속 모은다. 실패는 삼키지 않고 로그로 남긴다.
      console.error(`피드 실패 [${category.id}]: ${e.message}`);
      continue;
    }
    let taken = 0;
    for (const entry of entries) {
      if (taken >= MAX_NEW_PER_CATEGORY) break;
      if (known.has(entry.id)) continue;
      known.add(entry.id);
      try {
        const summary = await fetchArticle(entry, category);
        if (summary) {
          added.push(summary);
          taken += 1;
          console.log(`+ [${category.id}] ${summary.words}단어 · ${summary.title}`);
        }
      } catch (e) {
        console.error(`기사 실패 [${entry.id}]: ${e.message}`);
      }
    }
  }

  // 최신 기사가 앞에 오도록 정렬한 뒤 카테고리별로 오래된 것을 덜어낸다.
  const merged = [...added, ...index.articles].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const articles = await prune(merged);

  if (!added.length && index.articles.length === articles.length) {
    console.log("새 기사가 없습니다.");
    return;
  }
  await writeFile(INDEX_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), articles }, null, 2), "utf8");
  console.log(`총 ${articles.length}편 (새로 ${added.length}편)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
