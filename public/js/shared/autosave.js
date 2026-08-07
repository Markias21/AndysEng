// 자동 저장. autoSaveRecord()는 즉시 저장(글쓰기 첨삭 완료·회화 주제 전환처럼 "지금 막 중요한 게
// 생겼다" 시점), scheduleSave()는 5초 디바운스 후 저장(SRS 리뷰처럼 짧은 간격으로 반복되는 이벤트가
// 매번 네트워크를 쏘지 않도록)한다. 화면을 나가는 순간(tab hidden)은 디바운스를 기다리지 않고
// 즉시 플러시한다. 수동 저장 버튼은 sync 탭에 그대로 유지.
import { syncPayload, setLastSyncedAt } from "./store.js";
import { saveRecord } from "./supabase.js";
import { toast } from "./dom.js";

export async function autoSaveRecord() {
  try {
    await saveRecord(syncPayload());
    setLastSyncedAt(Date.now());
  } catch (e) {
    toast(`자동 저장 실패: ${e.message}`);
  }
}

let timer = null;

export function scheduleSave() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    autoSaveRecord();
  }, 5000);
}

function flush() {
  if (timer === null) return;
  clearTimeout(timer);
  timer = null;
  autoSaveRecord();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flush();
});
