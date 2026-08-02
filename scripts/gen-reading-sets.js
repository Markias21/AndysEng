// 리딩 문제 세트를 미리 만들어 public/data/reading/sets/에 커밋해 두는 1회성 백필 스크립트.
// 앱의 온디맨드 생성(features/reading/ai.js)과 완전히 같은 프롬프트·스키마를 그대로 재사용한다 —
// 유일한 차이는 브라우저의 유저별 API 키 대신 로컬 .env의 ANTHROPIC_API_KEY로, 유저 localStorage
// 대신 파일로 저장한다는 점이다. 이렇게 미리 실어 둔 지문은 어떤 유저가 열어도 AI 호출이 0회다
// (features/reading/catalog.js의 loadShippedSet → ai.js의 questionSet이 이 파일을 먼저 확인한다).
//
// 실행: node scripts/gen-reading-sets.js (ANTHROPIC_API_KEY는 .env 또는 환경변수)
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { GENERATE_SCHEMA } from "../public/js/features/reading/schema.js";
import { generateSystem } from "../public/js/features/reading/prompts.js";
import { bodyText, resolveBlanks } from "../public/js/features/reading/passage.js";
import { validQuestions } from "../public/js/features/reading/score.js";

const READING_DIR = fileURLToPath(new URL("../public/data/reading/", import.meta.url));
const SETS_DIR = `${READING_DIR}sets/`;
const ENV_FILE = fileURLToPath(new URL("../.env", import.meta.url));

// 레포에 실어 두는 기본 세트는 앱 기본 레벨(store.js의 profile.level 기본값)에 맞춘다.
// 유저가 다른 레벨이어도 문제 자체는 여전히 풀리므로, 개인화보다 비용 0을 택한 절충이다.
const LEVEL = "B1";
const MODEL = "claude-sonnet-5";
const PRICE_PER_MTOK = { input: 3, output: 15 };
// 미검증 데이터라 지문에서 실제로 안 잡히는 표현이 나올 수 있다. 너무 부실하면 한 번 다시 시도한다.
const MIN_BLANKS = 3;
const MAX_RETRIES = 1;

async function loadEnv() {
  try {
    const text = await readFile(ENV_FILE, "utf8");
    const env = {};
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

async function callClaude(apiKey, system, article) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: GENERATE_SCHEMA } },
      system,
      messages: [{ role: "user", content: `Title: ${article.title}\n\n${bodyText(article)}` }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `API 요청 실패 (${res.status})`);
  const usage = data.usage || {};
  const cost = ((usage.input_tokens || 0) * PRICE_PER_MTOK.input + (usage.output_tokens || 0) * PRICE_PER_MTOK.output) / 1_000_000;
  const block = data.content.find((b) => b.type === "text");
  if (!block) throw new Error("응답에 텍스트 블록이 없습니다.");
  return { set: JSON.parse(block.text), cost };
}

/** 생성 결과가 지문에 실제로 대응하는지 검증하고, 성립하지 않는 항목을 걸러낸다. */
function clean(article, raw) {
  const questions = validQuestions(raw.questions);
  const blanks = resolveBlanks(article, raw.blanks);
  return { ok: questions.length >= 4 && blanks.length >= MIN_BLANKS, questions, blanks: raw.blanks.filter((b) => blanks.some((r) => r.expression === b.expression)) };
}

async function generateOne(apiKey, article) {
  let lastCost = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { set, cost } = await callClaude(apiKey, generateSystem(LEVEL), article);
    lastCost += cost;
    const { ok, questions, blanks } = clean(article, set);
    if (ok || attempt === MAX_RETRIES) {
      // 레포에는 raw 스키마 그대로 싣는다(user 캐시와 같은 모양) — blanks의 영어 예문은
      // 매번 지문에서 되찾으므로(resolveBlanks) 중복 저장하지 않는다.
      return { cost: lastCost, ok, set: { ...set, questions, blanks } };
    }
  }
}

async function main() {
  const env = { ...(await loadEnv()), ...process.env };
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 없습니다 (.env 또는 환경변수).");

  await mkdir(SETS_DIR, { recursive: true });
  const { articles } = JSON.parse(await readFile(`${READING_DIR}index.json`, "utf8"));
  const already = new Set((await readdir(SETS_DIR).catch(() => [])).map((f) => f.replace(".json", "")));
  const limit = Number(env.LIMIT) || Infinity;
  const todo = articles.filter((a) => !already.has(a.id)).slice(0, limit);

  console.log(`대상 ${articles.length}편 중 ${todo.length}편 생성 (이미 있음 ${already.size}편 건너뜀)`);

  let totalCost = 0;
  let failed = 0;
  for (const [i, a] of todo.entries()) {
    const article = JSON.parse(await readFile(`${READING_DIR}${a.id}.json`, "utf8"));
    try {
      const { cost, ok, set } = await generateOne(apiKey, article);
      totalCost += cost;
      if (!ok) {
        failed += 1;
        console.warn(`  ⚠ [${i + 1}/${todo.length}] ${a.title} — 빈칸/문제가 부실해 건너뜀 (문제 ${set.questions.length}개, 빈칸 ${set.blanks.length}개)`);
        continue;
      }
      await writeFile(`${SETS_DIR}${a.id}.json`, JSON.stringify(set), "utf8");
      console.log(`  ✓ [${i + 1}/${todo.length}] ${a.title} (문제 ${set.questions.length}·빈칸 ${set.blanks.length}, 누적 $${totalCost.toFixed(3)})`);
    } catch (e) {
      failed += 1;
      console.error(`  ✗ [${i + 1}/${todo.length}] ${a.title}: ${e.message}`);
    }
  }

  console.log(`\n완료. 생성 ${todo.length - failed}편, 실패/건너뜀 ${failed}편, 총 비용 ≈ $${totalCost.toFixed(3)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
