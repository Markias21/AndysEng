// 외부 서비스(구글 드라이브 REST) 경계. 액세스 토큰을 인자로 받아 fetch로 직접 호출한다.
// 도메인 로직은 이 모듈을 import하지 않는다 — report/routes.js(애플리케이션 계층)만 사용한다.
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

async function driveFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`구글 드라이브 요청 실패 (${res.status}): ${body}`);
    err.status = res.status === 401 ? 401 : 502;
    throw err;
  }
  return res.json();
}

/** 이름으로 폴더를 찾는다. parentId가 null이면 내 드라이브 루트 기준. 없으면 null. */
export async function findFolder(token, name, parentId = null) {
  const parentClause = parentId ? `'${parentId}' in parents` : `'root' in parents`;
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and ${parentClause} and trashed=false`;
  const url = `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;
  const data = await driveFetch(token, url);
  return data.files[0]?.id || null;
}

/** 폴더를 찾고, 없으면 생성해서 folderId를 반환한다. */
export async function ensureFolder(token, name, parentId = null) {
  const existing = await findFolder(token, name, parentId);
  if (existing) return existing;
  const metadata = {
    name,
    mimeType: FOLDER_MIME,
    ...(parentId ? { parents: [parentId] } : {}),
  };
  const data = await driveFetch(token, `${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  return data.id;
}

/** 저장 대상 폴더 id. 연동 시 AndysNote/AndysEng, 아니면 루트 AndysEng. */
export async function resolveAppFolder(token, andysNoteLinked) {
  if (andysNoteLinked) {
    const parent = await ensureFolder(token, "AndysNote", null);
    return ensureFolder(token, "AndysEng", parent);
  }
  return ensureFolder(token, "AndysEng", null);
}

/** 해당 폴더에서 dateStr을 포함하는 파일 이름 목록 (리포트 번호 계산용). */
export async function listMarkdownFor(token, folderId, dateStr) {
  const q = `'${folderId}' in parents and name contains '${dateStr}' and trashed=false`;
  const url = `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;
  const data = await driveFetch(token, url);
  return data.files.map((f) => f.name);
}

/** 폴더 안에 파일을 새로 생성한다 (multipart 업로드). */
export async function uploadFile(token, folderId, name, mimeType, content) {
  const boundary = "andyseng" + Math.random().toString(16).slice(2);
  const metadata = { name, parents: [folderId] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;
  return driveFetch(token, `${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

/** 내 드라이브 루트 폴더 id. */
export async function getRootId(token) {
  const data = await driveFetch(token, `${API}/files/root?fields=id`);
  return data.id;
}

/** 폴더를 newParentId 아래로 이동한다 (현재 부모에서 제거). */
export async function moveFolderInto(token, folderId, newParentId) {
  const info = await driveFetch(token, `${API}/files/${folderId}?fields=parents`);
  const removeParents = (info.parents || []).join(",");
  const query = `addParents=${newParentId}${removeParents ? `&removeParents=${removeParents}` : ""}&fields=id,parents`;
  return driveFetch(token, `${API}/files/${folderId}?${query}`, { method: "PATCH" });
}
