// 문단 연습(produce 타입)의 유일한 AI 호출. 문단 1개·짧은 응답이라 비용이 작아,
// 리딩의 문제 세트 생성과 달리 사전 비용 확인창 없이 바로 부른다(회화·글쓰기 첨삭과 같은 대우).
import { chatJSON } from "../../shared/claude.js";
import { PRODUCE_GRADE_SCHEMA } from "./schema.js";
import { gradeSystem } from "./prompts.js";

export function gradeProduce({ paragraph, task, level, answer }) {
  return chatJSON({
    system: gradeSystem({ level, paragraph, task }),
    messages: [{ role: "user", content: answer }],
    schema: PRODUCE_GRADE_SCHEMA,
    maxTokens: 512,
  });
}
