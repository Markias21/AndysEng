// 번역기: 회화·글쓰기 툴바의 🌐 번역기 버튼으로 여는 공용 모달. 한국어 문장 → 영어 번역.
// 쓸 때마다 translate.js에 사용 횟수를 기록해 두면, 그 기능의 채점 시점에 점수가 깎인다.
import { translateToEnglish, recordTranslatorUse, TRANSLATOR_PENALTY } from "../../shared/translate.js";
import { $, esc } from "../../shared/dom.js";

let currentFeature = null;

function openModal(feature) {
  currentFeature = feature;
  $("#translate-penalty-note").textContent = `번역기를 쓰면 이번 판정에서 -${TRANSLATOR_PENALTY[feature]}점이 반영돼요.`;
  $("#translate-input").value = "";
  $("#translate-result").innerHTML = "";
  $("#translate-modal").classList.remove("hidden");
  $("#translate-input").focus();
}

function closeModal() {
  $("#translate-modal").classList.add("hidden");
}

async function onSubmit(ev) {
  ev.preventDefault();
  const text = $("#translate-input").value.trim();
  if (!text) return;
  const btn = $("#translate-btn");
  btn.disabled = true;
  $("#translate-result").innerHTML = `<p class="muted">번역 중...</p>`;
  try {
    const english = await translateToEnglish(text);
    recordTranslatorUse(currentFeature);
    $("#translate-result").innerHTML = `<p class="translate-en">${esc(english)}</p>
      <p class="small muted">-${TRANSLATOR_PENALTY[currentFeature]}점이 이번 판정에 반영돼요.</p>`;
  } catch (e) {
    $("#translate-result").innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
  } finally {
    btn.disabled = false;
  }
}

export function init() {
  $("#translate-form").addEventListener("submit", onSubmit);
  $("#translate-close").addEventListener("click", closeModal);
  $("#translate-modal").addEventListener("click", (ev) => {
    if (ev.target.id === "translate-modal") closeModal();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !$("#translate-modal").classList.contains("hidden")) closeModal();
  });
  document.querySelectorAll(".translate-open-btn").forEach((b) =>
    b.addEventListener("click", () => openModal(b.dataset.feature))
  );
}
