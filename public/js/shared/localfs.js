// 로컬 파일 저장 경계. File System Access API(크롬/엣지)로 사용자가 고른 폴더의
// AndysEng 하위 폴더에 저장하고, 미지원 브라우저는 다운로드로 폴백한다.
// 폴더 핸들은 localStorage에 못 넣으므로 IndexedDB에 보관한다.
const DB_NAME = "andyseng";
const STORE = "handles";
const HANDLE_KEY = "reportDir";
const APP_FOLDER = "AndysEng";

export function isSupported() {
  return typeof window.showDirectoryPicker === "function";
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function ensurePermission(handle) {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

/** 저장 폴더 핸들을 얻는다. 저장된 게 없거나 권한이 없으면 폴더 선택창을 띄운다. */
async function getReportDir() {
  let handle = await idbGet(HANDLE_KEY);
  if (handle && (await ensurePermission(handle).catch(() => false))) {
    return handle.getDirectoryHandle(APP_FOLDER, { create: true });
  }
  handle = await window.showDirectoryPicker({ mode: "readwrite", startIn: "downloads" });
  await idbSet(HANDLE_KEY, handle);
  return handle.getDirectoryHandle(APP_FOLDER, { create: true });
}

async function listFileNames(dir) {
  const names = [];
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind === "file") names.push(name);
  }
  return names;
}

async function writeFile(dir, name, content) {
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 리포트를 저장한다. files: [{name, content, type}].
 * 파일 이름 결정에 기존 파일 목록이 필요하면 nameFn(existingNames)으로 이름을 만든다.
 * 반환: 저장 방식("folder" | "download")과 실제 저장된 파일 이름들.
 */
export async function saveFiles(nameFn, makeFiles) {
  if (isSupported()) {
    const dir = await getReportDir();
    const existing = await listFileNames(dir);
    const files = makeFiles(nameFn(existing));
    for (const f of files) await writeFile(dir, f.name, f.content);
    return { method: "folder", names: files.map((f) => f.name) };
  }
  const files = makeFiles(nameFn([]));
  for (const f of files) download(f.name, f.content, f.type);
  return { method: "download", names: files.map((f) => f.name) };
}

export { download };
