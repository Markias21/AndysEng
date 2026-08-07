// 앱 부트스트랩: 키 금고 게이트 → 탭 전환 → 기능 초기화 → 서비스 워커 등록.
import { hasVault, createVault, unlockVault, deleteVault } from "./shared/keyvault.js";
import { setApiKey, clearApiKey } from "./shared/claude.js";
import { syncPayload, purgeExpressionCards, setLastSyncedAt } from "./shared/store.js";
import * as authSync from "./shared/supabase.js";
import { $, toast } from "./shared/dom.js";
import * as conversation from "./features/conversation/ui.js";
import * as writing from "./features/writing/ui.js";
import * as writingBasic from "./features/writing-basic/ui.js";
import * as report from "./features/report/ui.js";
import * as sync from "./features/sync/ui.js";
import * as stats from "./features/stats/ui.js";
import * as srs from "./features/srs/ui.js";
import * as srsHistory from "./features/srs/history-ui.js";
import * as reading from "./features/reading/ui.js";
import * as listening from "./features/listening/ui.js";
import * as sixmin from "./features/sixmin/ui.js";
import * as dictionary from "./features/dictionary/ui.js";
import * as translate from "./features/translate/ui.js";
import * as settings from "./features/settings/ui.js";

// ===== 키 게이트 =====
function showGate(mode) {
  $("#app").classList.add("hidden");
  $("#key-gate").classList.remove("hidden");
  $("#gate-setup").classList.toggle("hidden", mode !== "setup");
  $("#gate-unlock").classList.toggle("hidden", mode !== "unlock");
  const focus = mode === "setup" ? $("#setup-nickname") : $("#unlock-password");
  focus.focus();
}

function showApp() {
  $("#key-gate").classList.add("hidden");
  $("#app").classList.remove("hidden");
}

function initGate() {
  $("#gate-setup").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nickname = $("#setup-nickname").value.trim();
    const key = $("#setup-key").value.trim();
    const pw = $("#setup-password").value;
    const pw2 = $("#setup-password2").value;
    if (!nickname) return toast("닉네임을 입력해 주세요.");
    if (!key.startsWith("sk-ant-")) return toast("Anthropic API 키(sk-ant-...)를 입력해 주세요.");
    if (pw.length < 6) return toast("비밀번호는 6자 이상으로 정해 주세요.");
    if (pw !== pw2) return toast("비밀번호가 서로 달라요.");
    try {
      await authSync.signUp(nickname, pw);
    } catch (e) {
      return toast(e.message);
    }
    await createVault({ nickname, claudeKey: key }, pw);
    setApiKey(key);
    // 이 기기에 있던 기존 학습 기록을 새 계정으로 최초 1회 올려 둔다.
    try {
      await authSync.saveRecord(syncPayload());
      setLastSyncedAt(Date.now());
    } catch (e) {
      toast(`최초 저장 실패: ${e.message}`);
    }
    $("#setup-nickname").value = "";
    $("#setup-key").value = "";
    $("#setup-password").value = "";
    $("#setup-password2").value = "";
    toast("암호화해서 저장했어요.");
    showApp();
  });

  $("#gate-unlock").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const pw = $("#unlock-password").value;
    try {
      const { nickname, claudeKey } = await unlockVault(pw);
      await authSync.signIn(nickname, pw);
      setApiKey(claudeKey);
      $("#unlock-password").value = "";
      showApp();
    } catch (e) {
      toast(e.message);
    }
  });

  $("#gate-reset").addEventListener("click", () => {
    if (!confirm("저장된 정보를 삭제하고 다시 설정할까요? (학습 기록은 유지됩니다)")) return;
    deleteVault();
    clearApiKey();
    authSync.clearSession();
    showGate("setup");
  });

  $("#lock-btn").addEventListener("click", () => {
    clearApiKey();
    authSync.clearSession();
    showGate("unlock");
    toast("잠갔어요. 비밀번호로 다시 열 수 있어요.");
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
      if (tab.dataset.view === "writing-basic") writingBasic.render();
      if (tab.dataset.view === "reading") reading.render();
      if (tab.dataset.view === "listening") listening.render();
      if (tab.dataset.view === "sixmin") sixmin.render();
    });
  });
}

/**
 * 개발 서버(dev-server.js)가 .env 기반으로 제공하는 /__dev/session이 있으면 게이트를 건너뛴다.
 * 정적 배포(GitHub Pages 등)에는 이 라우트가 존재하지 않아 항상 실패하고 정상 게이트로 넘어간다.
 * Claude 키만 즉시 쓸 수 있게 하고, Supabase 로그인은 이어지지 않는다 — 동기화가 필요하면
 * 정상 게이트로 한 번 로그인해 두면 된다.
 */
async function tryDevAutoLogin() {
  try {
    const res = await fetch("/__dev/session");
    if (!res.ok) return false;
    const { claudeKey } = await res.json();
    setApiKey(claudeKey);
    showApp();
    return true;
  } catch {
    return false;
  }
}

async function init() {
  // 옛 "표현 공부"에서 쌓인 복습 카드를 한 번 정리한다(복습은 이제 회화·글쓰기 표현만 다룬다).
  purgeExpressionCards();
  settings.init({
    onStudyChange: () => {
      if ($("#view-srs").classList.contains("active")) srs.render();
    },
  });
  initGate();
  initTabs();
  conversation.init();
  writing.init();
  report.init();
  sync.init();
  dictionary.init();
  translate.init();
  srsHistory.init();

  if (!(await tryDevAutoLogin())) {
    showGate(hasVault() ? "unlock" : "setup");
  }

  if ("serviceWorker" in navigator) {
    // updateViaCache: "none" — GitHub Pages가 sw.js에 max-age 캐시 헤더를 붙이므로,
    // 지정하지 않으면 브라우저가 그 캐시 기간 동안 새 배포를 감지하지 못한다.
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {
      /* 오프라인 셸은 부가 기능 — 등록 실패해도 앱은 동작한다 */
    });
  }
}

init();
