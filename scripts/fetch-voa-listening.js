// VOA "Words and Their Stories"를 모아 public/data/listening/ 에 JSON으로 떨어뜨린다.
// scripts/fetch-voa.js(리딩)와 거의 같은 구조지만, 분량 기준이 다르고(짧은 프로그램)
// 오디오가 없는 기사는 아예 버린다(이 기능의 핵심이 듣기이므로). 출력 디렉터리도 분리되어 있다.
// GitHub Actions가 매일 돌리고 결과를 커밋한다(→ pages.yml이 배포 → 앱은 same-origin으로 읽음).
//
// 실행: node scripts/fetch-voa-listening.js
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { LISTENING_CATEGORIES, feedUrl, parseArticle, parseFeed, wordCount } from "./voa-parse.js";

const OUT_DIR = join(process.cwd(), "public", "data", "listening");
const INDEX_PATH = join(OUT_DIR, "index.json");

// 카테고리가 하나뿐이라(관용구 이야기) 리딩보다 넉넉히 남겨 둔다.
const KEEP_PER_CATEGORY = 20;
const MAX_NEW_PER_CATEGORY = process.env.SEED ? KEEP_PER_CATEGORY : 2;
// 1~3분 학습을 노린다. 실측(2026-08) 기준 이 프로그램은 300~500단어대가 대부분이라 위아래로 여유를 둔다.
const MIN_WORDS = 150;
const MAX_WORDS = 600;

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

/** 기사 하나를 받아 저장한다. 분량이 맞지 않거나 오디오가 없으면 저장하지 않고 null을 반환한다. */
async function fetchArticle(entry, category) {
  const { paragraphs, glossary, audio } = parseArticle(await get(entry.link));
  const words = wordCount(paragraphs);
  if (words < MIN_WORDS || words > MAX_WORDS) return null;
  if (!audio) return null;

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
  for (const category of LISTENING_CATEGORIES) {
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

  for (const category of LISTENING_CATEGORIES) {
    let entries;
    try {
      entries = parseFeed(await get(feedUrl(category)));
    } catch (e) {
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
