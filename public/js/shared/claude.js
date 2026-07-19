// 외부 서비스(Claude API) 경계. 기능 코드는 이 모듈의 함수만 사용한다.
// 브라우저에서 직접 호출하며, 키는 메모리에만 존재한다 (keyvault가 복호화해 넘겨줌).
import { recordUsage } from "./store.js";
import { costUsd } from "./usage.js";
// 선택 가능한 모델. 설정에서 고른 값이 profile.model로 저장되고 setModel으로 반영된다.
export const MODELS = {
  "claude-sonnet-5": "Sonnet (더 똑똑함)",
  "claude-haiku-4-5-20251001": "Haiku (더 빠르고 저렴)",
};
const DEFAULT_MODEL = "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

let apiKey = null;
let model = DEFAULT_MODEL;

export function setModel(id) {
  model = MODELS[id] ? id : DEFAULT_MODEL;
}

export function getModel() {
  return model;
}

export function setApiKey(key) {
  apiKey = key;
}

export function clearApiKey() {
  apiKey = null;
}

export function hasApiKey() {
  return apiKey !== null;
}

async function request(body) {
  if (!apiKey) throw new Error("API 키가 잠겨 있습니다. 비밀번호로 잠금을 해제하세요.");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) throw new Error("API 키가 올바르지 않습니다. 키를 다시 설정하세요.");
    throw new Error(data.error?.message || `Claude API 요청 실패 (${res.status})`);
  }
  if (data.usage) recordUsage(body.model, costUsd(body.model, data.usage));
  return data;
}

// Haiku 4.5는 adaptive thinking·effort를 지원하지 않는다(소넷 계열 전용 기능).
const SUPPORTS_ADAPTIVE_THINKING = (id) => !id.startsWith("claude-haiku");

/**
 * JSON 스키마가 보장된 구조화 응답 (첨삭/채점).
 * modelOverride를 주면 설정 모델 대신 그 모델로 호출한다(예: 사전은 Haiku 고정).
 */
export async function chatJSON({ system, messages, schema, maxTokens = 2048, modelOverride }) {
  const targetModel = modelOverride || model;
  const response = await request({
    model: targetModel,
    max_tokens: maxTokens,
    ...(SUPPORTS_ADAPTIVE_THINKING(targetModel) ? { thinking: { type: "adaptive" } } : {}),
    output_config: {
      ...(SUPPORTS_ADAPTIVE_THINKING(targetModel) ? { effort: "medium" } : {}),
      format: { type: "json_schema", schema },
    },
    system,
    messages,
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block) throw new Error("모델 응답에 텍스트 블록이 없습니다.");
  return JSON.parse(block.text);
}
