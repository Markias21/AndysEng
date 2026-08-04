// BBC 6 Minute English 에피소드의 **링크만** 모아 public/data/6min/index.json에 떨어뜨린다.
//
// 대본 텍스트는 절대 저장하지 않는다 — BBC 콘텐츠는 VOA와 달리 퍼블릭 도메인이 아니라, 공개
// 레포·GitHub Pages에 본문을 실으면 공개 재배포가 된다. 대신 대본 PDF는 앱이 열 때 브라우저가
// downloads.bbc.co.uk에서 직접 받아 파싱한다(그쪽은 access-control-allow-origin: * 라 가능하다).
// 여기서 Node로 도는 이유는 에피소드 HTML 페이지만 CORS 헤더를 주지 않기 때문이다.
//
// 실행: node scripts/fetch-bbc.js   (전체 백필은 SEED=1 node scripts/fetch-bbc.js)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LIST_URL, parseEpisodeAssets, parseEpisodeList } from "./bbc-parse.js";

const OUT_DIR = join(process.cwd(), "public", "data", "6min");
const INDEX_PATH = join(OUT_DIR, "index.json");

const KEEP = 40;
const MAX_NEW_PER_RUN = process.env.SEED ? KEEP : 3;

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "AndysEng/1.0 (personal English study app)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function readIndex() {
  try {
    return JSON.parse(await readFile(INDEX_PATH, "utf8"));
  } catch {
    return { updatedAt: null, episodes: [] };
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const index = await readIndex();
  const known = new Set(index.episodes.map((e) => e.id));

  const listed = parseEpisodeList(await get(LIST_URL));
  console.log(`목록에서 ${listed.length}편 확인`);

  const added = [];
  for (const episode of listed) {
    if (added.length >= MAX_NEW_PER_RUN) break;
    if (known.has(episode.id)) continue;
    try {
      const { audioUrl, transcriptUrl } = parseEpisodeAssets(await get(episode.pageUrl), episode.id);
      // 대본이 없으면 받아쓰기도 문제도 성립하지 않는다. 조용히 넘기지 않고 남긴다.
      if (!audioUrl || !transcriptUrl) {
        console.error(`자산 없음 [${episode.id}] ${episode.title} (audio=${!!audioUrl} transcript=${!!transcriptUrl})`);
        continue;
      }
      added.push({ ...episode, audioUrl, transcriptUrl });
      console.log(`+ ${episode.date} ${episode.title}`);
    } catch (e) {
      console.error(`에피소드 실패 [${episode.id}]: ${e.message}`);
    }
  }

  if (!added.length) {
    console.log("새 에피소드가 없습니다.");
    return;
  }
  const episodes = [...added, ...index.episodes].sort((a, b) => b.id.localeCompare(a.id)).slice(0, KEEP);
  await writeFile(INDEX_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), episodes }, null, 2), "utf8");
  console.log(`총 ${episodes.length}편 (새로 ${added.length}편)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
