// 글쓰기 첨삭 완료·회화 주제 전환 시점에 자동으로 GitHub에 저장한다 (수동 저장 버튼은 sync 탭에 그대로 유지).
import { exportJSON, setLastSyncedAt } from "./store.js";
import { saveRecord } from "./github.js";
import { toast } from "./dom.js";

export async function autoSaveToGithub() {
  try {
    await saveRecord(exportJSON());
    setLastSyncedAt(Date.now());
  } catch (e) {
    toast(`자동 저장 실패: ${e.message}`);
  }
}
