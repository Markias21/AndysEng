import { OAuth2Client } from "google-auth-library";

// 외부 서비스(구글 OAuth) 경계. 기능 코드는 이 모듈의 함수만 사용한다.
// claude.js와 동일하게, 키가 없으면 503으로 명확히 알린다 — 키만 주입하면 바로 동작.
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive", // AndysNote 폴더 검색·이동을 위해 전체 drive 스코프 필요
];

const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";

export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function makeClient() {
  if (!isConfigured()) {
    const err = new Error(
      "구글 OAuth가 설정되지 않았습니다. .env에 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 추가하세요."
    );
    err.status = 503;
    throw err;
  }
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

/** 동의 화면 URL. offline+consent로 refresh_token을 확보한다. */
export function buildAuthUrl(state) {
  return makeClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

/** 인증 코드 → { tokens, profile }. ID 토큰을 검증해 프로필을 얻는다. */
export async function exchangeCode(code) {
  const client = makeClient();
  const { tokens } = await client.getToken(code);
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  const profile = {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || "",
  };
  return { tokens, profile };
}

/** refresh_token으로 유효한 드라이브 액세스 토큰을 발급받는다. */
export async function getAccessToken(refreshToken) {
  if (!refreshToken) {
    const err = new Error("드라이브 접근 권한이 없습니다. 로그아웃 후 다시 로그인해 주세요.");
    err.status = 401;
    throw err;
  }
  const client = makeClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  return token;
}
