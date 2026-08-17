// Claude API 프록시. 진짜 Anthropic 키는 여기(Edge Function 비밀값)에만 있고,
// 브라우저(public/js/shared/claude.js)는 Supabase 로그인 토큰으로 이 함수를 호출한다.
//
// 순서: 로그인 확인 → 승인(profiles.status='approved') 확인 → 모델/토큰 한도 검증
//       → 오늘 사용량이 한도 미만인지 확인 → Anthropic 호출 → 사용량 반영 → 응답 그대로 전달.
//
// 승인 여부는 RLS(본인 profiles 행만 보임)로 확인하므로 이 함수 자체는 authenticated 클라이언트로
// 조회하고, usage_daily 쓰기는 authenticated에 INSERT/UPDATE 정책이 없어(003_usage.sql) service_role
// 클라이언트로만 한다 — 클라이언트가 자기 사용량을 조작할 수 없다.
//
// 배포: Supabase 대시보드 Edge Functions 편집기에 그대로 붙여넣기(이 레포에 CI 배포 파이프라인이
// 없다 — 002_approval.sql/scripts/db.js와 같은 "사람이 손으로 실행" 전례를 따른다).
// 배포 후 Edge Functions → Secrets에 ANTHROPIC_API_KEY를 설정해야 한다
// (SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY는 모든 Edge Function에 기본 제공됨).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const ALLOWED_MODELS = ["claude-sonnet-5", "claude-haiku-4-5-20251001"]; // public/js/shared/claude.js MODELS와 동일하게 유지
const MAX_TOKENS_CAP = 8192;
const DAILY_CAP_USD = 1.0; // 유저별 하루 한도

// public/js/shared/usage.js의 costUsd와 동일한 계산식. 순수 함수라 그대로 복제했다 —
// 가격이 바뀌면 두 곳(여기와 shared/usage.js) 다 고쳐야 한다.
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};
const CACHE_READ_DISCOUNT = 0.1;

function costUsd(model: string, usage: Record<string, number> | undefined) {
  const price = PRICING_USD_PER_MTOK[model];
  if (!price || !usage) return 0;
  const input = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  const cacheRead = usage.cache_read_input_tokens || 0;
  const output = usage.output_tokens || 0;
  return (input * price.input + cacheRead * price.input * CACHE_READ_DISCOUNT + output * price.output) / 1_000_000;
}

/** 서울 자정 기준 날짜(YYYY-MM-DD). shared/date.js의 toSeoulDate와 같은 개념을 여기서 다시 구현한다. */
function seoulDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "로그인이 필요합니다." });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const {
    data: { user },
  } = await asUser.auth.getUser();
  if (!user) return json(401, { error: "로그인이 만료됐어요. 다시 로그인해 주세요." });

  const { data: profile } = await asUser.from("profiles").select("status").eq("user_id", user.id).single();
  if (profile?.status !== "approved") return json(403, { error: "승인되지 않은 계정이에요." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "잘못된 요청이에요." });
  }
  if (typeof body.model !== "string" || !ALLOWED_MODELS.includes(body.model)) {
    return json(400, { error: "허용되지 않은 모델이에요." });
  }
  if (typeof body.max_tokens !== "number" || body.max_tokens > MAX_TOKENS_CAP) {
    return json(400, { error: "max_tokens가 너무 커요." });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const day = seoulDate();
  const { data: usageRow } = await admin
    .from("usage_daily")
    .select("cost_usd")
    .eq("user_id", user.id)
    .eq("day", day)
    .maybeSingle();
  const spentToday = usageRow?.cost_usd ?? 0;
  if (spentToday >= DAILY_CAP_USD) {
    return json(429, { error: "오늘 사용량 한도를 다 썼어요. 내일 다시 시도해 주세요." });
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const data = await anthropicRes.json();

  if (anthropicRes.ok && data.usage) {
    const cost = costUsd(body.model as string, data.usage);
    await admin
      .from("usage_daily")
      .upsert({ user_id: user.id, day, cost_usd: spentToday + cost }, { onConflict: "user_id,day" });
  }

  return json(anthropicRes.status, data);
});
