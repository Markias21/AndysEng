import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, articleId, parseArticle, parseFeed, wordCount } from "./voa-parse.js";
import { CATEGORIES as APP_CATEGORIES } from "../public/js/features/reading/catalog.js";

test("카테고리 id와 피드 id는 서로 겹치지 않는다", () => {
  assert.equal(new Set(CATEGORIES.map((c) => c.id)).size, CATEGORIES.length);
  assert.equal(new Set(CATEGORIES.map((c) => c.feed)).size, CATEGORIES.length);
});

// 수집 스크립트(Node)와 앱(브라우저)은 배포 경계가 달라 모듈을 공유할 수 없고 목록을 각자 들고 있다.
// 한쪽만 고치면 앱에 영영 안 보이는 카테고리가 생기므로 여기서 어긋남을 잡는다.
test("수집 스크립트와 앱의 카테고리 목록이 일치한다", () => {
  assert.deepEqual(
    APP_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
    CATEGORIES.map((c) => ({ id: c.id, label: c.label }))
  );
});

test("articleId는 URL 끝의 기사 번호를 뽑는다", () => {
  assert.equal(articleId("https://learningenglish.voanews.com/a/some-title/7921334.html"), "7921334");
  assert.equal(articleId("https://learningenglish.voanews.com/a/8007217.html"), "8007217");
  assert.equal(articleId("https://learningenglish.voanews.com/rssfeeds"), null);
});

test("parseFeed는 item에서 제목·링크·id를 뽑고 id 없는 항목은 버린다", () => {
  const xml = `<rss><channel>
    <item><title>How &amp; Why</title><link>https://x/a/t/123456.html</link><pubDate>Mon, 10 Mar 2025 22:00:00 +0000</pubDate></item>
    <item><title>No id</title><link>https://x/rssfeeds</link></item>
  </channel></rss>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "123456");
  assert.equal(items[0].title, "How & Why");
  assert.equal(items[0].pubDate, "Mon, 10 Mar 2025 22:00:00 +0000");
});

// 실제 VOA 기사의 구조를 그대로 줄인 것: 플레이어 자리표시자(class 있는 <p>) → 본문 → 소제목 →
// 사인오프 → 밑줄 구분선 → 어휘 풀이 → 공유 버튼(class 있는 <p>).
const ARTICLE = `<html><body><div class="wsw">
  <p class="ta-c"><span class="ico"></span>No media source currently available</p>
  <p>Many of us might only seek out <strong>physical therapists</strong> after an injury.</p>
  <p><strong>Follow the example of dental care </strong></p>
  <p>Earhart urges people to think about therapists as they do dentists.</p>
  <p>I'm John Russell.</p>
  <p>Stephen Wade reported on this story for the Associated Press.</p>
  <p>____________________________________________________</p>
  <p><strong>insurance </strong><em>– n.</em> an agreement to cover medical costs</p>
  <p><strong>milestone</strong><em> – n.</em> an important development</p>
  <p class="buttons link-print"><button title="Print">Print</button></p>
</div>
<a href="https://voa-audio.voanews.eu/vle/2025/01/02/abc.mp3">audio</a></body></html>`;

test("parseArticle은 본문·소제목·어휘 풀이·오디오를 나누고 잡동사니를 버린다", () => {
  const { paragraphs, glossary, audio } = parseArticle(ARTICLE);

  assert.deepEqual(
    paragraphs.map((p) => p.type),
    ["para", "heading", "para"]
  );
  assert.equal(paragraphs[0].text, "Many of us might only seek out physical therapists after an injury.");
  assert.equal(paragraphs[1].text, "Follow the example of dental care");

  // 플레이어 자리표시자·인쇄 버튼(class 있는 <p>)과 사인오프·출처 표기는 본문에 남지 않는다.
  const joined = paragraphs.map((p) => p.text).join(" ");
  assert.ok(!joined.includes("No media source"));
  assert.ok(!joined.includes("Print"));
  assert.ok(!joined.includes("I'm John Russell"));
  assert.ok(!joined.includes("Associated Press"));

  assert.deepEqual(glossary, [
    { word: "insurance", pos: "n", meaning: "an agreement to cover medical costs" },
    { word: "milestone", pos: "n", meaning: "an important development" },
  ]);
  assert.equal(audio, "https://voa-audio.voanews.eu/vle/2025/01/02/abc.mp3");
});

test("wordCount는 소제목을 빼고 본문 단어만 센다", () => {
  const { paragraphs } = parseArticle(ARTICLE);
  assert.equal(wordCount(paragraphs), 12 + 11);
});
