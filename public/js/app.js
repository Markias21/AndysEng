// 앱 부트스트랩: 키 금고 게이트 → 탭 전환 → 기능 초기화 → 서비스 워커 등록.
import { hasVault, createVault, unlockVault, deleteVault } from "./shared/keyvault.js";
import { setApiKey, clearApiKey } from "./shared/claude.js";
import { $, toast } from "./shared/dom.js";
import * as conversation from "./features/conversation/ui.js";
import * as writing from "./features/writing/ui.js";
import * as expression from "./features/expression/ui.js";
import * as report from "./features/report/ui.js";
import * as stats from "./features/stats/ui.js";
import * as srs from "./features/srs/ui.js";

// ===== 키 게이트 =====
function showGate(mode) {
  $("#app").classList.add("hidden");
  $("#key-gate").classList.remove("hidden");
  $("#gate-setup").classList.toggle("hidden", mode !== "setup");
  $("#gate-unlock").classList.toggle("hidden", mode !== "unlock");
  const focus = mode === "setup" ? $("#setup-key") : $("#unlock-password");
  focus.focus();
}

function showApp() {
  $("#key-gate").classList.add("hidden");
  $("#app").classList.remove("hidden");
}

function initGate() {
  $("#gate-setup").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const key = $("#setup-key").value.trim();
    const pw = $("#setup-password").value;
    const pw2 = $("#setup-password2").value;
    if (!key.startsWith("sk-ant-")) return toast("Anthropic API 키(sk-ant-...)를 입력해 주세요.");
    if (pw.length < 4) return toast("비밀번호는 4자 이상으로 정해 주세요.");
    if (pw !== pw2) return toast("비밀번호가 서로 달라요.");
    await createVault(key, pw);
    setApiKey(key);
    $("#setup-key").value = "";
    $("#setup-password").value = "";
    $("#setup-password2").value = "";
    toast("키를 암호화해 저장했어요.");
    showApp();
  });

  $("#gate-unlock").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const key = await unlockVault($("#unlock-password").value);
      setApiKey(key);
      $("#unlock-password").value = "";
      showApp();
    } catch (e) {
      toast(e.message);
    }
  });

  $("#gate-reset").addEventListener("click", () => {
    if (!confirm("저장된 API 키를 삭제하고 다시 설정할까요? (학습 기록은 유지됩니다)")) return;
    deleteVault();
    clearApiKey();
    showGate("setup");
  });

  $("#lock-btn").addEventListener("click", () => {
    clearApiKey();
    showGate("unlock");
    toast("키를 잠갔어요. 비밀번호로 다시 열 수 있어요.");
  });
}

// ===== 탭 전환 =====
function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      tab.classList.add("active");
      $(`#view-${tab.dataset.view}`).classList.add("active");
      if (tab.dataset.view === "stats") stats.render();
      if (tab.dataset.view === "srs") srs.render();
    });
  });
}

function init() {
  initGate();
  initTabs();
  conversation.init();
  writing.init();
  expression.init();
  report.init();
  showGate(hasVault() ? "unlock" : "setup");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* 오프라인 셸은 부가 기능 — 등록 실패해도 앱은 동작한다 */
    });
  }
}

init();
