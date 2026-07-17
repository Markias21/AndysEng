import { Router } from "express";
import { getUser, getRecords, setLastReportAt, setUserSetting } from "../../shared/store.js";
import { getAccessToken } from "../../shared/google-auth.js";
import {
  resolveAppFolder,
  listMarkdownFor,
  uploadFile,
  ensureFolder,
  findFolder,
  moveFolderInto,
  getRootId,
} from "../../shared/drive.js";
import { buildReport, nextReportName } from "./report.js";

// "공부 끝내기" → 지난 리포트 이후의 학습 기록을 md/json으로 드라이브에 저장.
// AndysNote 연동 토글 → 저장 폴더 위치 변경 + 기존 폴더 이동.
const router = Router();

const FEATURES = ["conversation", "writing", "expression"];

function seoulDate(d) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(d); // YYYY-MM-DD
}
function seoulLabel(d) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d); // YYYY-MM-DD HH:mm
}

router.post("/finish", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = getUser(userId);
    const since = user.lastReportAt ? Date.parse(user.lastReportAt) : 0;

    const sessionRecords = {};
    let total = 0;
    for (const feature of FEATURES) {
      const recent = getRecords(userId, feature).filter((r) => Date.parse(r.ts) > since);
      sessionRecords[feature] = recent;
      total += recent.length;
    }
    if (total === 0) {
      return res.status(400).json({ error: "이번 세션에 저장할 학습 기록이 없습니다." });
    }

    const now = new Date();
    const md = buildReport(sessionRecords, { dateLabel: seoulLabel(now), userName: req.user.name });
    const json = JSON.stringify(
      { generatedAt: now.toISOString(), user: req.user.email, records: sessionRecords },
      null,
      2
    );

    const token = await getAccessToken(user.tokens.refresh_token);
    const folderId = await resolveAppFolder(token, user.settings.andysNoteLinked);
    const dateStr = seoulDate(now);
    const existing = await listMarkdownFor(token, folderId, dateStr);
    const mdName = nextReportName(dateStr, existing);
    const jsonName = mdName.replace(/\.md$/, ".json");

    const mdFile = await uploadFile(token, folderId, mdName, "text/markdown", md);
    await uploadFile(token, folderId, jsonName, "application/json", json);

    setLastReportAt(userId, now.toISOString());
    res.json({ file: mdName, link: mdFile.webViewLink || null, count: total });
  } catch (err) {
    next(err);
  }
});

router.post("/andysnote", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = getUser(userId);
    const { linked } = req.body;
    if (typeof linked !== "boolean") {
      return res.status(400).json({ error: "linked(boolean)가 필요합니다." });
    }

    const token = await getAccessToken(user.tokens.refresh_token);
    if (linked) {
      // 연동 ON: 기존 루트 AndysEng 폴더를 AndysNote 안으로 이동.
      const andysNote = await ensureFolder(token, "AndysNote", null);
      const rootAndysEng = await findFolder(token, "AndysEng", null);
      if (rootAndysEng) await moveFolderInto(token, rootAndysEng, andysNote);
    } else {
      // 연동 OFF: AndysNote 안 AndysEng 폴더를 루트로 되돌린다.
      const andysNote = await findFolder(token, "AndysNote", null);
      const nested = andysNote ? await findFolder(token, "AndysEng", andysNote) : null;
      if (nested) {
        const root = await getRootId(token);
        await moveFolderInto(token, nested, root);
      }
    }

    setUserSetting(userId, "andysNoteLinked", linked);
    res.json({ andysNoteLinked: linked });
  } catch (err) {
    next(err);
  }
});

export default router;
