// 설정: 톱니바퀴 → 모달. 테마(라이트/다크)·AI 모델·CEFR 레벨·표현 수집 개수를 한 곳에서 관리한다.
// 설정 값은 store.profile에 저장되고, 앱 시작 시 적용된다.
import { getProfile, setProfile } from "../../shared/store.js";
import { setModel, MODELS } from "../../shared/claude.js";
import { $ } from "../../shared/dom.js";

// 다른 기능이 레벨 변경에 반응해야 할 때 쓰는 콜백(예: 복습 다시 그리기).
let onLevelChange = () => {};

/** 저장된 테마를 <html>에 반영한다. 게이트 화면부터 적용되도록 가장 먼저 호출한다. */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}

function openModal() {
  $("#settings-modal").classList.remove("hidden");
}

function closeModal() {
  $("#settings-modal").classList.add("hidden");
}

export function init(opts = {}) {
  onLevelChange = opts.onLevelChange || onLevelChange;
  const profile = getProfile();

  // 시작 시 저장된 값 적용
  applyTheme(profile.theme);
  setModel(profile.model);

  // 모델 옵션 채우기
  const modelSel = $("#set-model");
  modelSel.innerHTML = Object.entries(MODELS)
    .map(([id, label]) => `<option value="${id}">${label}</option>`)
    .join("");

  // 현재 값으로 컨트롤 동기화
  $("#set-theme").value = profile.theme;
  modelSel.value = profile.model;
  $("#set-level").value = profile.level;
  $("#set-expr-count").value = String(profile.exprPerConv);

  // 열기/닫기
  $("#settings-btn").addEventListener("click", openModal);
  $("#settings-close").addEventListener("click", closeModal);
  $("#settings-modal").addEventListener("click", (ev) => {
    if (ev.target.id === "settings-modal") closeModal();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !$("#settings-modal").classList.contains("hidden")) closeModal();
  });

  // 테마
  $("#set-theme").addEventListener("change", (ev) => {
    const theme = ev.target.value;
    setProfile({ theme });
    applyTheme(theme);
  });

  // 모델
  modelSel.addEventListener("change", (ev) => {
    setProfile({ model: ev.target.value });
    setModel(ev.target.value);
  });

  // 레벨
  $("#set-level").addEventListener("change", (ev) => {
    setProfile({ level: ev.target.value });
    onLevelChange();
  });

  // 표현 수집 개수
  $("#set-expr-count").addEventListener("change", (ev) => {
    setProfile({ exprPerConv: Number(ev.target.value) });
  });
}
