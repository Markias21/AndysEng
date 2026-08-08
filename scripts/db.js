// Supabase PostgREST 클라이언트. 서비스 롤 키로 RLS를 우회해 DB를 직접 조작한다.
// 이 스크립트는 사람이 손으로 실행하는 관리용 도구이지, 앱 코드에서 import하지 않는다.
// 서비스 롤 키는 앱 배포 레포 전체 쓰기 권한을 가진 민감한 시크릿이므로, 반드시 .env에만 둔다.
//
// 실행: node scripts/db.js select <table> [--filter "col=op.val"] [--columns a,b]
//      node scripts/db.js insert <table> '<json>'
//      node scripts/db.js update <table> --filter "col=op.val" '<json>'
//      node scripts/db.js delete <table> --filter "col=op.val"
//
// 필터 연산자: eq(같음), neq, lt, lte, gt, gte, like, in, is 등 PostgREST 스타일.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ENV_FILE = fileURLToPath(new URL("../.env", import.meta.url));

async function loadEnv() {
  try {
    const text = await readFile(ENV_FILE, "utf8");
    const env = {};
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.substring(0, i).trim();
      const val = t.substring(i + 1).trim();
      env[key] = val.startsWith('"') && val.endsWith('"')
        ? val.slice(1, -1)
        : val;
    }
    return env;
  } catch (e) {
    console.error(`⚠️ 전역 .env 없거나 읽기 실패 (process.env 폴백)\n${e.message}`);
    return {};
  }
}

function parseArgs(args) {
  const cmd = args[0];
  const table = args[1];
  const result = { cmd, table, filter: null, columns: null, data: null };

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--filter" && i + 1 < args.length) {
      result.filter = args[++i];
    } else if (args[i] === "--columns" && i + 1 < args.length) {
      result.columns = args[++i];
    } else if (!args[i].startsWith("--")) {
      result.data = args[i];
    }
  }
  return result;
}

async function request(method, url, headers, body = null) {
  const opts = { method, headers };
  if (body) opts.body = body;
  const res = await fetch(url, opts);
  let data;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  return { status: res.status, data };
}

async function main() {
  const env = await loadEnv();
  const URL = env.SUPABASE_URL || process.env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!URL || !KEY) {
    console.error("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 .env 또는 환경변수에 설정해야 합니다.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(`사용법:
  node scripts/db.js select <table> [--filter "col=op.val"] [--columns a,b]
  node scripts/db.js insert <table> '<json>'
  node scripts/db.js update <table> --filter "col=op.val" '<json>'
  node scripts/db.js delete <table> --filter "col=op.val"`);
    process.exit(1);
  }

  const parsed = parseArgs(args);
  const headers = {
    "apikey": KEY,
    "Authorization": `Bearer ${KEY}`,
    "Content-Type": "application/json",
  };

  try {
    switch (parsed.cmd) {
      case "select": {
        let url = `${URL}/rest/v1/${parsed.table}`;
        if (parsed.columns) url += `?select=${parsed.columns}`;
        if (parsed.filter) {
          const sep = url.includes("?") ? "&" : "?";
          url += sep + parsed.filter;
        }
        const res = await request("GET", url, headers);
        if (res.status >= 400) {
          console.error(`❌ [${res.status}]`, res.data);
          process.exit(1);
        }
        console.log(JSON.stringify(res.data, null, 2));
        break;
      }

      case "insert": {
        if (!parsed.data) {
          console.error("❌ insert에는 JSON 데이터가 필요합니다.");
          process.exit(1);
        }
        const url = `${URL}/rest/v1/${parsed.table}`;
        headers["Prefer"] = "return=representation";
        const res = await request("POST", url, headers, parsed.data);
        if (res.status >= 400) {
          console.error(`❌ [${res.status}]`, res.data);
          process.exit(1);
        }
        console.log(JSON.stringify(res.data, null, 2));
        break;
      }

      case "update": {
        if (!parsed.data || !parsed.filter) {
          console.error("❌ update에는 --filter와 JSON 데이터가 필요합니다.");
          process.exit(1);
        }
        let url = `${URL}/rest/v1/${parsed.table}?${parsed.filter}`;
        headers["Prefer"] = "return=representation";
        const res = await request("PATCH", url, headers, parsed.data);
        if (res.status >= 400) {
          console.error(`❌ [${res.status}]`, res.data);
          process.exit(1);
        }
        console.log(JSON.stringify(res.data, null, 2));
        break;
      }

      case "delete": {
        if (!parsed.filter) {
          console.error("❌ delete에는 --filter가 필요합니다.");
          process.exit(1);
        }
        const url = `${URL}/rest/v1/${parsed.table}?${parsed.filter}`;
        headers["Prefer"] = "return=representation";
        const res = await request("DELETE", url, headers);
        if (res.status >= 400) {
          console.error(`❌ [${res.status}]`, res.data);
          process.exit(1);
        }
        console.log(JSON.stringify(res.data, null, 2));
        break;
      }

      default:
        console.error(`❌ 알 수 없는 커맨드: ${parsed.cmd}`);
        process.exit(1);
    }
  } catch (e) {
    console.error(`❌ 요청 실패:\n${e.message}`);
    process.exit(1);
  }
}

main();
