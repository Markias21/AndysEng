// 외부 서비스(GitHub Contents API) 경계. 기능 코드는 이 모듈의 함수만 사용한다.
// 친구 그룹이 공유 프라이빗 레포에 닉네임별로 학습 기록을 저장/불러오기 한다.
const REPO = "Markias21/AndysEng_log";
const API_BASE = `https://api.github.com/repos/${REPO}/contents`;

let session = null; // { nickname, token }

export function setSession({ nickname, token }) {
  session = { nickname, token };
}

export function clearSession() {
  session = null;
}

/** nickname을 저장 경로로 바꾼다. 경로에 쓰일 수 없는 값이면 throw. */
export function dataPath(nickname) {
  const name = (nickname || "").trim();
  if (!name) throw new Error("닉네임이 비어 있습니다.");
  if (name.includes("/") || name.includes("..")) {
    throw new Error("닉네임에 '/' 또는 '..'는 사용할 수 없습니다.");
  }
  return `data/${name}/andyseng-data.json`;
}

function toB64(str) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

function fromB64(b64) {
  const bytes = Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function request(path, token, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

/** 저장. 기존 파일이 있으면 sha를 먼저 조회해 덮어쓴다(409 방지). */
export async function saveRecord(jsonString) {
  if (!session) throw new Error("GitHub에 로그인되어 있지 않습니다.");
  const { nickname, token } = session;
  const path = dataPath(nickname);

  const getRes = await request(path, token);
  let sha;
  if (getRes.status === 200) {
    sha = (await getRes.json()).sha;
  } else if (getRes.status !== 404) {
    throw await githubError(getRes);
  }

  const putRes = await request(path, token, {
    method: "PUT",
    body: {
      message: `AndysEng: ${nickname} 학습 기록 저장`,
      content: toB64(jsonString),
      ...(sha ? { sha } : {}),
    },
  });
  if (!putRes.ok) {
    if (putRes.status === 409) {
      throw new Error("다른 기기에서 방금 저장했어요. 불러오기 후 다시 저장해 주세요.");
    }
    throw await githubError(putRes);
  }
}

/** 불러오기. 파일이 없으면 null 반환(신규 사용자). */
export async function loadRecord() {
  if (!session) throw new Error("GitHub에 로그인되어 있지 않습니다.");
  const { nickname, token } = session;
  const path = dataPath(nickname);

  const res = await request(path, token);
  if (res.status === 404) return null;
  if (!res.ok) throw await githubError(res);
  const { content } = await res.json();
  return fromB64(content);
}

async function githubError(res) {
  if (res.status === 401) {
    return new Error("GitHub 토큰이 올바르지 않아요. 토큰을 다시 확인해 주세요.");
  }
  if (res.status === 403 || res.status === 404) {
    return new Error("레포에 접근할 수 없어요. 토큰 권한을 확인해 주세요.");
  }
  return new Error(`GitHub API 요청 실패 (${res.status})`);
}
