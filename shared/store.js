import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 학습 기록 저장소 (JSON 파일). 기능별 배열에 레코드를 append한다.
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const EMPTY = { conversation: [], writing: [], expression: [] };

function load() {
  if (!fs.existsSync(STORE_PATH)) return structuredClone(EMPTY);
  return { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) };
}

function save(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function appendRecord(feature, record) {
  const store = load();
  if (!(feature in store)) throw new Error(`알 수 없는 기능: ${feature}`);
  store[feature].push({ ts: new Date().toISOString(), ...record });
  save(store);
}

export function getRecords(feature) {
  const store = load();
  if (!(feature in store)) throw new Error(`알 수 없는 기능: ${feature}`);
  return store[feature];
}
