// 가입 신청 목록 정렬·표시용 순수 함수. Supabase profiles 행({user_id, nickname, note,
// status, created_at, reviewed_at, is_admin})을 받아 화면이 바로 쓸 형태로 다듬는다.

const STATUS_ORDER = { pending: 0, approved: 1, rejected: 2 };

/** 심사 대기 중인 신청이 먼저, 그 안에서는 오래 기다린 순. 심사 끝난 것은 뒤로. */
export function sortRequests(profiles) {
  return profiles.slice().sort((a, b) => {
    const order = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (order !== 0) return order;
    return new Date(a.created_at) - new Date(b.created_at);
  });
}

const STATUS_LABELS = { pending: "⏳ 대기 중", approved: "✅ 승인됨", rejected: "🚫 거절됨" };

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}
