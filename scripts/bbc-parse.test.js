import test from "node:test";
import assert from "node:assert/strict";
import { dateOf, parseEpisodeAssets, parseEpisodeList } from "./bbc-parse.js";

// 실제 목록 페이지의 구조를 그대로 줄인 것: 같은 에피소드가 이미지·제목 두 군데서 링크되고,
// 다른 시리즈(Real Easy English)로 가는 링크가 섞여 있다.
const LIST = `<html><body>
  <p><a href="https://www.bbc.co.uk/learningenglish/english/features/real-easy-english">Real Easy English</a></p>
  <div class="img"><a  href="/learningenglish/english/features/6-minute-english_2026/ep-260730"><img /></a></div>
  <div class="text"><h2><a  href="/learningenglish/english/features/6-minute-english_2026/ep-260730">The Enhanced Games</a></h2></div>
  <div class="text"><h2><a href="/learningenglish/english/features/6-minute-english_2026/ep-260716">What&#39;s in a footballer&rsquo;s brain?</a></h2></div>
  <div class="text"><h2><a href="/learningenglish/english/features/6-minute-english_2025/ep-251225">Tea &amp; biscuits</a></h2></div>
  <div class="text"><h2><a href="/learningenglish/english/features/6-minute-english">View all 6 Minute English</a></h2></div>
</body></html>`;

test("parseEpisodeList는 에피소드만 최신순으로 뽑고 중복·다른 시리즈를 버린다", () => {
  const eps = parseEpisodeList(LIST);
  assert.deepEqual(
    eps.map((e) => e.id),
    ["260730", "260716", "251225"]
  );
  assert.equal(eps[0].title, "The Enhanced Games");
  assert.equal(eps[0].pageUrl, "https://www.bbc.co.uk/learningenglish/english/features/6-minute-english_2026/ep-260730");
  assert.equal(eps[0].date, "2026-07-30");
  // 목록 페이지 자체로 가는 "View all" 링크는 ep-여야 하는 경로 규칙에 걸려 빠진다.
  assert.ok(!eps.some((e) => e.title.startsWith("View all")));
});

test("parseEpisodeList는 제목의 HTML 엔티티를 푼다", () => {
  const eps = parseEpisodeList(LIST);
  assert.equal(eps[1].title, "What's in a footballer’s brain?");
  assert.equal(eps[2].title, "Tea & biscuits");
});

test("dateOf는 ep 슬러그의 YYMMDD를 ISO 날짜로 바꾼다", () => {
  assert.equal(dateOf("260730"), "2026-07-30");
  assert.equal(dateOf("ep-260730"), null);
});

const asset = (name) => `<a href="https://downloads.bbc.co.uk/learningenglish/features/6min/${name}">x</a>`;

test("parseEpisodeAssets는 오디오와 대본 PDF만 고르고 워크시트는 버린다", () => {
  const html =
    asset("260730_6_minute_english_x_worksheet.pdf") +
    asset("260730_6_minute_english_x_transcript.pdf") +
    asset("260730_6_minute_english_x_download.mp3");
  const { audioUrl, transcriptUrl } = parseEpisodeAssets(html, "260730");
  assert.ok(transcriptUrl.endsWith("_transcript.pdf"));
  assert.ok(audioUrl.endsWith("_download.mp3"));
});

// 파일명 규칙이 회차마다 흔들린다(전부 실제로 관찰된 사례다).
test("parseEpisodeAssets는 흔들리는 파일명 규칙을 견딘다", () => {
  // 오타로 붙은 밑줄, _download 접미사가 아예 없는 오디오.
  const a = parseEpisodeAssets(
    asset("260326_6_minute_english_weight_loss_drugs__transcript.pdf") + asset("260326_6_minute_english_weight_loss_drugs_download_.mp3"),
    "260326"
  );
  assert.ok(a.transcriptUrl.endsWith("__transcript.pdf"));
  assert.ok(a.audioUrl.endsWith("_download_.mp3"));

  const b = parseEpisodeAssets(asset("260723_6_minute_english_children_in_warzones.mp3"), "260723");
  assert.ok(b.audioUrl.endsWith("children_in_warzones.mp3"));

  // 제목의 아포스트로피가 URL에 그대로 남는 회차 — 여기서 URL이 잘리면 대본을 못 받는다.
  const c = parseEpisodeAssets(asset("260716_6_minute_english_what's_in_a_footballer's_brain_transcript.pdf"), "260716");
  assert.ok(c.transcriptUrl.endsWith("footballer's_brain_transcript.pdf"));
});

test("parseEpisodeAssets는 다른 회차 파일이 섞여 있으면 내 id로 시작하는 것을 고른다", () => {
  const html = asset("251225_6_minute_english_old_download.mp3") + asset("260730_6_minute_english_x_download.mp3");
  assert.ok(parseEpisodeAssets(html, "260730").audioUrl.includes("260730"));
});

test("parseEpisodeAssets는 자산이 없으면 null을 준다", () => {
  assert.deepEqual(parseEpisodeAssets("<html></html>", "260730"), { audioUrl: null, transcriptUrl: null });
});
