import Anthropic from "@anthropic-ai/sdk";

// 외부 서비스(Claude API) 경계. 도메인/기능 코드는 이 모듈의 함수만 사용한다.
const MODEL = "claude-opus-4-8";

let client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error(
      "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY=... 를 추가하세요."
    );
    err.status = 503;
    throw err;
  }
  if (!client) client = new Anthropic();
  return client;
}

/** 자유 텍스트 응답 (회화 등 빠른 턴) */
export async function chatText({ system, messages, maxTokens = 1024 }) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system,
    messages,
  });
  const block = response.content.find((b) => b.type === "text");
  return block ? block.text : "";
}

/** JSON 스키마가 보장된 구조화 응답 (첨삭/채점) */
export async function chatJSON({ system, messages, schema, maxTokens = 4096 }) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema },
    },
    system,
    messages,
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block) throw new Error("모델 응답에 텍스트 블록이 없습니다.");
  return JSON.parse(block.text);
}
