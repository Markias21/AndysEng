// API 키 금고. 키를 비밀번호(PBKDF2 → AES-GCM)로 암호화해 localStorage에 보관하고,
// 비밀번호를 입력한 세션에서만 메모리로 복호화한다. 평문 키는 절대 저장하지 않는다.
const VAULT_KEY = "andyseng:vault";
const ITERATIONS = 310000;

function toB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function hasVault() {
  return localStorage.getItem(VAULT_KEY) !== null;
}

export async function createVault(apiKey, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(apiKey)
  );
  localStorage.setItem(
    VAULT_KEY,
    JSON.stringify({ v: 1, iter: ITERATIONS, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) })
  );
}

/** 비밀번호가 틀리면 throw. 맞으면 API 키 문자열 반환. */
export async function unlockVault(password) {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) throw new Error("저장된 API 키가 없습니다.");
  const vault = JSON.parse(raw);
  const key = await deriveKey(password, fromB64(vault.salt), vault.iter);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(vault.iv) },
      key,
      fromB64(vault.ct)
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("비밀번호가 틀렸습니다.");
  }
}

export function deleteVault() {
  localStorage.removeItem(VAULT_KEY);
}
