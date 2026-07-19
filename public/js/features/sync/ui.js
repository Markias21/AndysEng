// GitHub 동기화: 수동 저장/불러오기 버튼. 자동 저장 없음.
import { exportJSON, importJSON, setLastSyncedAt } from "../../shared/store.js";
import { saveRecord, loadRecord } from "../../shared/github.js";
import { $, toast } from "../../shared/dom.js";

async function handleSave() {
  await saveRecord(exportJSON());
  setLastSyncedAt(Date.now());
  toast("GitHub에 저장했어요.");
}

async function handleLoad() {
  if (!confirm("GitHub에서 불러오면 현재 기기의 학습 기록을 덮어써요. 계속할까요?")) return;
  const text = await loadRecord();
  if (text === null) return toast("GitHub에 저장된 기록이 없어요.");
  importJSON(text);
  setLastSyncedAt(Date.now());
  toast("GitHub에서 불러왔어요.");
}

export function init() {
  $("#sync-save-btn").addEventListener("click", async () => {
    const btn = $("#sync-save-btn");
    btn.disabled = true;
    try {
      await handleSave();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
    }
  });

  $("#sync-load-btn").addEventListener("click", async () => {
    const btn = $("#sync-load-btn");
    btn.disabled = true;
    try {
      await handleLoad();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
    }
  });
}
