// 앱 부트스트랩: 키 금고 게이트 → 탭 전환 → 기능 초기화 → 서비스 워커 등록.
import { hasVault, createVault, unlockVault, deleteVault } from "./shared/keyvault.js";
import { syncPayload, purgeExpressionCards, setLastSyncedAt } from "./shared/store.js";
import * as authSync from "./shared/supabase.js";
import { $, toast } from "./shared/dom.js";
import { registerView, showView } from "./shared/router.js";
import * as today from "./features/today/ui.js";
import * as toeflHub from "./features/toefl-hub/ui.js";
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
import * as admin from "./features/admin/ui.js";

// ===== 키 게이트 =====
// setup(가입 신청) → pending(승인 대기) → unlock(로그인)이 정상 경로다.
// 승인 전에는 로그인 자체가 막힌다 — 화면 게이트는 UX이고, 실제 강제는 Supabase RLS(profiles.status)가 한다.
function showGate(mode) {
  $("#app").classList.add("hidden");
  $("#key-gate").classList.remove("hidden");
  $("#gate-setup").classList.toggle("hidden", mode !== "setup");
  $("#gate-unlock").classList.toggle("hidden", mode !== "unlock");
  $("#gate-pending").classList.toggle("hidden", mode !== "pending");
  if (mode === "setup") $("#setup-nickname").focus();
  if (mode === "unlock") $("#unlock-password").focus();
}

function showPending(message) {
  $("#gate-pending-msg").textContent = message;
  showGate("pending");
}

function showApp() {
  $("#key-gate").classList.add("hidden");
  $("#app").classList.remove("hidden");
}

/**
 * 로그인(signIn) 성공 뒤 호출. 가입 승인 상태를 확인해 승인된 계정만 실제로 들여보낸다.
 * profiles 행이 아직 없으면(가입 신청이 중간에 끊긴 경우) 다시 신청해 둔다.
 */
async function enterIfApproved(nickname) {
  let profile;
  try {
    profile = (await authSync.fetchProfile(nickname)) || (await authSync.ensureProfile(nickname));
  } catch (e) {
    authSync.clearSession();
    return toast(`계정 확인 실패: ${e.message}`);
  }
  if (profile.status !== "approved") {
    authSync.clearSession();
    return showPending(
      profile.status === "rejected"
        ? "🚫 가입 신청이 거절됐어요. 관리자에게 문의해 주세요."
        : "⏳ 가입 승인을 기다리고 있어요. 관리자가 승인하면 다시 로그인할 수 있어요."
    );
  }

  showApp();
  showView("today");
  if (profile.is_admin) admin.render();

  // 이 계정으로 처음 승인된 로그인이면(원격 기록이 아직 비어 있으면) 이 기기 기록을 최초 1회 올려 둔다.
  try {
    const remote = await authSync.loadRecord();
    if (remote === null) {
      await authSync.saveRecord(syncPayload());
      setLastSyncedAt(Date.now());
    }
  } catch (e) {
    toast(`최초 저장 확인 실패: ${e.message}`);
  }
}

function initGate() {
  $("#gate-setup").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nickname = $("#setup-nickname").value.trim();
    const pw = $("#setup-password").value;
    const pw2 = $("#setup-password2").value;
    const note = $("#setup-note").value.trim();
    if (!nickname) return toast("닉네임을 입력해 주세요.");
    if (pw.length < 6) return toast("비밀번호는 6자 이상으로 정해 주세요.");
    if (pw !== pw2) return toast("비밀번호가 서로 달라요.");
    try {
      await authSync.signUpRequest(nickname, pw, note);
    } catch (e) {
      return toast(e.message);
    }
    // 로컬 금고는 그대로 지금 만들어 둔다 — 승인 후에는 평소처럼 비밀번호만 넣는 unlock으로 들어온다.
    await createVault({ nickname }, pw);
    $("#setup-nickname").value = "";
    $("#setup-password").value = "";
    $("#setup-password2").value = "";
    $("#setup-note").value = "";
    showPending("⏳ 가입 신청을 접수했어요. 관리자가 승인하면 다시 로그인할 수 있어요.");
  });

  $("#gate-unlock").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const pw = $("#unlock-password").value;
    let nickname;
    try {
      ({ nickname } = await unlockVault(pw));
      await authSync.signIn(nickname, pw);
    } catch (e) {
      return toast(e.message);
    }
    $("#unlock-password").value = "";
    await enterIfApproved(nickname);
  });

  $("#gate-pending-retry").addEventListener("click", () => showGate("unlock"));

  $("#gate-reset").addEventListener("click", () => {
    if (!confirm("저장된 정보를 삭제하고 다시 설정할까요? (학습 기록은 유지됩니다)")) return;
    deleteVault();
    authSync.clearSession();
    $("#admin-panel").classList.add("hidden");
    showGate("setup");
  });

  $("#lock-btn").addEventListener("click", () => {
    authSync.clearSession();
    $("#admin-panel").classList.add("hidden");
    showGate("unlock");
    toast("잠갔어요. 비밀번호로 다시 열 수 있어요.");
  });
}

// ===== 화면 전환 =====
// 탭은 5개지만 view는 8개다 — 글쓰기·글쓰기 기본·리딩·3분 학습·리스닝은 탭 없이
// 🎯 토플 허브나 🏠 오늘의 추천에서 들어간다. 어느 탭을 켤지는 보낸 쪽이 정한다(router.js).
function initViews() {
  registerView("today", today.render);
  registerView("toefl", toeflHub.render);
  registerView("stats", stats.render);
  registerView("srs", srs.render);
  registerView("writing", writing.render);
  registerView("writing-basic", writingBasic.render);
  registerView("reading", reading.render);
  registerView("listening", listening.render);
  registerView("sixmin", sixmin.render);
  document.querySelectorAll(".tab").forEach((tab) =>
    tab.addEventListener("click", () => showView(tab.dataset.view))
  );
}

async function init() {
  // 옛 "표현 공부"에서 쌓인 복습 카드를 한 번 정리한다(복습은 이제 회화·글쓰기 표현만 다룬다).
  purgeExpressionCards();
  settings.init({
    onStudyChange: () => {
      // 설정(레벨·하루 학습량·주간 목표)이 바뀌면 지금 보고 있는 화면만 다시 그린다.
      if ($("#view-srs").classList.contains("active")) srs.render();
      if ($("#view-today").classList.contains("active")) today.render();
    },
  });
  initGate();
  initViews();
  conversation.init();
  writing.init();
  report.init();
  sync.init();
  dictionary.init();
  translate.init();
  srsHistory.init();
  admin.init();

  showGate(hasVault() ? "unlock" : "setup");

  if ("serviceWorker" in navigator) {
    // updateViaCache: "none" — GitHub Pages가 sw.js에 max-age 캐시 헤더를 붙이므로,
    // 지정하지 않으면 브라우저가 그 캐시 기간 동안 새 배포를 감지하지 못한다.
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {
      /* 오프라인 셸은 부가 기능 — 등록 실패해도 앱은 동작한다 */
    });
  }
}

init();
