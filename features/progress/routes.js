import { Router } from "express";
import { getRecords } from "../../shared/store.js";
import { summarize } from "./progress.js";

// 공부량 체크: 기능별 학습량 + 점수 통계, 글쓰기는 저장된 피드백 전체를 함께 반환.
const router = Router();

router.get("/", (req, res, next) => {
  try {
    const conversation = getRecords("conversation");
    const writing = getRecords("writing");
    const expression = getRecords("expression");
    res.json({
      conversation: summarize(conversation),
      writing: { ...summarize(writing), history: writing.slice().reverse() },
      expression: {
        ...summarize(expression),
        history: expression
          .slice()
          .reverse()
          .map(({ ts, score, expression: expr, sentence }) => ({ ts, score, expression: expr, sentence })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
