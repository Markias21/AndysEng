// 관리자 패널: 설정 모달 안에 붙는 가입 신청 목록. 관리자(닉네임 andy)로 로그인했을 때만
// app.js가 render()를 호출해 패널을 보여준다 — 비관리자는 애초에 이 모듈을 쓸 일이 없다
// (Supabase RLS도 비관리자의 listProfiles를 본인 행 하나로만 돌려준다).
import { listProfiles, reviewProfile } from "../../shared/supabase.js";
import { sortRequests, statusLabel } from "./requests.js";
import { $, esc, toast } from "../../shared/dom.js";

function actionsHTML(p) {
  const approve = `<button class="btn-secondary btn-chip" data-user="${p.user_id}" data-status="approved">승인</button>`;
  const reject = `<button class="btn-secondary btn-chip" data-user="${p.user_id}" data-status="rejected">거절</button>`;
  if (p.status === "pending") return approve + reject;
  if (p.status === "approved") return reject;
  return approve; // rejected → 다시 승인으로 되돌릴 수 있게
}

function rowHTML(p) {
  const date = new Date(p.created_at).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return `<div class="history-item">
    <div class="hi-date">${date} 신청</div>
    <b>${esc(p.nickname)}</b> <span class="chip">${statusLabel(p.status)}</span>
    ${p.note ? `<div class="small muted">${esc(p.note)}</div>` : ""}
    <div class="row-actions">${actionsHTML(p)}</div>
  </div>`;
}

async function render() {
  $("#admin-panel").classList.remove("hidden");
  const list = $("#admin-list");
  list.innerHTML = `<p class="muted small">불러오는 중…</p>`;
  try {
    const profiles = await listProfiles();
    list.innerHTML = sortRequests(profiles).map(rowHTML).join("") || `<p class="muted small">가입 신청이 없어요.</p>`;
  } catch (e) {
    list.innerHTML = `<p class="muted small">불러오기 실패: ${esc(e.message)}</p>`;
  }
}

async function handleReview(userId, status) {
  if (status === "rejected" && !confirm("이 신청을 거절할까요? 나중에 다시 승인으로 되돌릴 수 있어요.")) return;
  try {
    await reviewProfile(userId, status);
    toast(status === "approved" ? "승인했어요." : "거절했어요.");
    await render();
  } catch (e) {
    toast(e.message);
  }
}

export function init() {
  $("#admin-list").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-user]");
    if (!btn) return;
    handleReview(btn.dataset.user, btn.dataset.status);
  });
}

export { render };
