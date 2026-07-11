import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import conversationRoutes from "./features/conversation/routes.js";
import writingRoutes from "./features/writing/routes.js";
import expressionRoutes from "./features/expression/routes.js";
import progressRoutes from "./features/progress/routes.js";

const app = express();
const ROOT = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(ROOT, "public")));

app.use("/api/conversation", conversationRoutes);
app.use("/api/writing", writingRoutes);
app.use("/api/expression", expressionRoutes);
app.use("/api/progress", progressRoutes);

// 에러는 삼키지 않고 클라이언트에 명시적으로 전달한다.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "서버 오류가 발생했습니다." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AndysEng 실행 중: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("경고: ANTHROPIC_API_KEY가 없어 AI 기능이 동작하지 않습니다. .env에 설정하세요.");
  }
});
