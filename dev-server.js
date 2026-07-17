// 개발용 정적 파일 서버. 배포는 정적 호스팅(GitHub Pages 등)에 public/을 올리면 된다.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("./public", import.meta.url));
const ENV_FILE = fileURLToPath(new URL("./.env", import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/** 아주 단순한 .env 파서 (KEY=VALUE, # 주석, 빈 줄만 지원). 의존성 추가 없이 dev 편의만 제공한다. */
async function loadEnv() {
  try {
    const text = await readFile(ENV_FILE, "utf8");
    const env = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i === -1) continue;
      env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

const env = await loadEnv();

/**
 * 코드스페이스 등 개발 환경에서 .env에 키가 있으면 게이트를 건너뛸 수 있도록 세션을 내려준다.
 * 정적 배포에는 이 서버 자체가 없으므로 프로덕션에는 존재하지 않는 라우트다.
 */
function devSession() {
  if (!env.ANTHROPIC_API_KEY || !env.GITHUB_PAT_API_KEY) return null;
  return {
    nickname: "Andy",
    claudeKey: env.ANTHROPIC_API_KEY,
    githubToken: env.GITHUB_PAT_API_KEY,
  };
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);

  if (path === "/__dev/session") {
    const session = devSession();
    if (!session) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(session));
    return;
  }

  const file = normalize(join(ROOT, path === "/" ? "index.html" : path));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
}).listen(PORT, () => {
  console.log(`AndysEng dev: http://localhost:${PORT}`);
});
