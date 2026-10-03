// 화면 전환. 탭 5개(오늘·토플·회화·복습·기록)가 view 8개를 가리키므로
// "어느 탭을 켤지"와 "어느 view를 보여줄지"를 분리한다 — 🎯 토플 허브가 탭 없는 화면(글쓰기·리딩·리스닝 등)으로 보낸다.
//
// 뒤로가기 버튼을 기능 화면 안에 넣지 않고 #subnav(= .view 섹션들 바깥)에 그리는 이유:
// 그래야 기능 파일을 하나도 건드리지 않고 진입 경로만 바꿀 수 있다.
import { $, esc } from "./dom.js";

const renderers = new Map();

/** 기능의 render를 view 이름으로 등록한다. render는 선택적으로 mode를 받는다(하위 모드 직접 진입). */
export function registerView(name, render) {
  renderers.set(name, render);
}

function renderSubnav(back) {
  const bar = $("#subnav");
  if (!back) {
    bar.innerHTML = "";
    bar.classList.add("hidden");
    return;
  }
  bar.innerHTML = `<button class="btn-text" type="button">← ${esc(back.label)}</button>`;
  bar.querySelector("button").addEventListener("click", () => showView(back.to));
  bar.classList.remove("hidden");
}

/**
 * view를 보여 준다.
 * tab: 켜 둘 상단 탭(기본값은 view 이름 — 탭이 없는 view는 보낸 쪽이 지정한다)
 * back: { label, to } — 전역 뒤로가기 바
 * mode: 기능의 하위 모드(예: 글쓰기 "email"). 해당 기능의 render로 그대로 넘어간다.
 */
export function showView(name, { tab = name, back = null, mode = null } = {}) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === tab));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  renderSubnav(back);
  renderers.get(name)?.(mode);
  window.scrollTo(0, 0);
}
