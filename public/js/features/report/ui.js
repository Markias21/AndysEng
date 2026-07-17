// 공부 끝내기: 마지막 리포트 이후의 기록을 모아 로컬 폴더(AndysEng)에 md+json으로 저장한다.
import { buildReport, nextReportName } from "./report.js";
import { getAllRecords, getLastReportAt, setLastReportAt } from "../../shared/store.js";
import { saveFiles, isSupported } from "../../shared/localfs.js";
import { $, toast } from "../../shared/dom.js";

function seoulParts(date) {
  const dateStr = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(date);
  const label = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "long",
  }).format(date);
  return { dateStr, label };
}

function recordsSince(all, sinceISO) {
  const result = {};
  for (const [kind, list] of Object.entries(all)) {
    result[kind] = sinceISO ? list.filter((r) => r.ts > sinceISO) : list.slice();
  }
  return result;
}

async function finishStudy() {
  const since = getLastReportAt();
  const records = recordsSince(getAllRecords(), since);
  const total =
    records.conversation.length + records.writing.length + records.expression.length + records.quiz.length;
  if (total === 0) return toast("저장할 새 학습 기록이 없어요.");

  const now = new Date();
  const { dateStr, label } = seoulParts(now);
  const md = buildReport(records, { dateLabel: label });

  const { method, names } = await saveFiles(
    (existingNames) => nextReportName(dateStr, existingNames),
    (mdName) => [
      { name: mdName, content: md, type: "text/markdown" },
      {
        name: mdName.replace(/\.md$/, ".json"),
        content: JSON.stringify({ generatedAt: now.toISOString(), since, records }, null, 2),
        type: "application/json",
      },
    ]
  );
  setLastReportAt(now.toISOString());
  toast(
    method === "folder"
      ? `AndysEng 폴더에 저장했어요: ${names[0]}`
      : `다운로드했어요: ${names.join(", ")} (이 브라우저는 폴더 저장을 지원하지 않아요)`
  );
}

export function init() {
  $("#finish-btn").addEventListener("click", async () => {
    const btn = $("#finish-btn");
    btn.disabled = true;
    try {
      await finishStudy();
    } catch (e) {
      if (e.name !== "AbortError") toast(e.message); // 폴더 선택 취소는 조용히 넘어간다
    } finally {
      btn.disabled = false;
    }
  });
  if (!isSupported()) {
    $("#finish-btn").title = "이 브라우저는 폴더 저장을 지원하지 않아 다운로드로 저장됩니다.";
  }
}
