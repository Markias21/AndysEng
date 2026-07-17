// ===== 공통 유틸 =====
const $ = (sel) => document.querySelector(sel);

async function api(path, body) {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (res.status === 401) {
    showLoginGate();
    throw new Error(data.error || "로그인이 필요합니다.");
  }
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add("hidden"), 4000);
}

function scoreBadge(score) {
  const cls = score >= 85 ? "score-high" : score >= 60 ? "score-mid" : "score-low";
  return `<span class="score-badge ${cls}">${score}점</span>`;
}

function correctionsHTML(corrections) {
  if (!corrections || corrections.length === 0) return "";
  return `<ul>${corrections
    .map(
      (c) =>
        `<li><span class="strike">${esc(c.original)}</span> → <span class="fixed">${esc(c.corrected)}</span><br/><span class="reason">${esc(c.reason)}</span></li>`
    )
    .join("")}</ul>`;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

// ===== 탭 전환 =====
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    tab.classList.add("active");
    $(`#view-${tab.dataset.view}`).classList.add("active");
    if (tab.dataset.view === "progress") loadProgress();
  });
});

// ===== 회화 =====
const convHistory = []; // {role: "ai"|"user", text}

function addBubble(role, text) {
  const el = document.createElement("div");
  el.className = `bubble ${role}`;
  el.textContent = text;
  $("#conv-messages").appendChild(el);
  el.scrollIntoView({ behavior: "smooth", block: "end" });
  return el;
}

function addFeedback({ corrections, natural_alternative, score }) {
  const el = document.createElement("div");
  const good = (!corrections || corrections.length === 0) && !natural_alternative;
  el.className = `feedback ${good ? "good" : ""}`;
  el.innerHTML = good
    ? `<div class="fb-title">✅ 자연스러운 표현이에요! ${scoreBadge(score)}</div>`
    : `<div class="fb-title">📝 피드백 ${scoreBadge(score)}</div>
       ${correctionsHTML(corrections)}
       ${natural_alternative ? `<div>💬 원어민이라면: <span class="fixed">${esc(natural_alternative)}</span></div>` : ""}`;
  $("#conv-messages").appendChild(el);
  el.scrollIntoView({ behavior: "smooth", block: "end" });
}

$("#conv-start").addEventListener("click", async () => {
  const btn = $("#conv-start");
  btn.disabled = true;
  try {
    const { message } = await api("/conversation/start", {});
    $("#conv-intro").classList.add("hidden");
    $("#conv-room").classList.remove("hidden");
    convHistory.push({ role: "ai", text: message });
    addBubble("ai", message);
    $("#conv-input").focus();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
});

$("#conv-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const input = $("#conv-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addBubble("user", text);
  const typing = addBubble("ai typing", "생각 중...");
  try {
    const result = await api("/conversation/reply", { history: convHistory, userMessage: text });
    convHistory.push({ role: "user", text });
    typing.remove();
    addFeedback(result);
    convHistory.push({ role: "ai", text: result.reply });
    addBubble("ai", result.reply);
  } catch (e) {
    typing.remove();
    toast(e.message);
  }
});

// ===== 글쓰기 =====
async function newWritingQuestion() {
  const { question } = await api("/writing/question", {});
  $("#writing-question").textContent = question;
  $("#writing-input").value = "";
  $("#writing-result").innerHTML = "";
  $("#writing-intro").classList.add("hidden");
  $("#writing-room").classList.remove("hidden");
}

$("#writing-start").addEventListener("click", async () => {
  const btn = $("#writing-start");
  btn.disabled = true;
  try {
    await newWritingQuestion();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
});

$("#writing-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const answer = $("#writing-input").value.trim();
  if (!answer) return toast("답안을 먼저 작성해 주세요.");
  const btn = ev.target.querySelector("button");
  btn.disabled = true;
  btn.textContent = "첨삭 중...";
  try {
    const r = await api("/writing/review", { question: $("#writing-question").textContent, answer });
    $("#writing-result").innerHTML = `
      <div class="result-section">
        <h4>📝 문법 첨삭 ${scoreBadge(r.score)}</h4>
        <div class="card">${r.corrections.length ? correctionsHTML(r.corrections) : "✅ 문법 오류가 없어요!"}</div>
        <h4>✔️ 교정된 답안</h4>
        <div class="card">${esc(r.corrected_answer)}</div>
        <h4>🌟 원어민 모범 답안</h4>
        <div class="card">${esc(r.native_answer)}</div>
        <h4>💡 익혀두면 좋은 표현</h4>
        <div class="card"><ul>${r.native_expressions
          .map((e) => `<li><b>${esc(e.expression)}</b> — ${esc(e.meaning)}<br/><span class="reason">${esc(e.example)}</span></li>`)
          .join("")}</ul></div>
        <div class="row-end"><button class="btn-secondary" id="writing-next">다음 질문 →</button></div>
      </div>`;
    $("#writing-next").addEventListener("click", () => newWritingQuestion().catch((e) => toast(e.message)));
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "첨삭 받기";
  }
});

// ===== 표현 =====
async function nextExpression() {
  const r = await api("/expression/next", {});
  $("#expr-word").textContent = r.expression;
  $("#expr-meaning").textContent = r.meaning;
  $("#expr-example").textContent = `예문: ${r.example}`;
  $("#expr-input").value = "";
  $("#expr-result").innerHTML = "";
  $("#expr-next-row").classList.add("hidden");
  $("#expr-intro").classList.add("hidden");
  $("#expr-room").classList.remove("hidden");
}

$("#expr-start").addEventListener("click", async () => {
  const btn = $("#expr-start");
  btn.disabled = true;
  try {
    await nextExpression();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
});

$("#expr-next").addEventListener("click", () => nextExpression().catch((e) => toast(e.message)));

$("#expr-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const sentence = $("#expr-input").value.trim();
  if (!sentence) return toast("예문을 먼저 작성해 주세요.");
  const btn = ev.target.querySelector("button");
  btn.disabled = true;
  btn.textContent = "첨삭 중...";
  try {
    const r = await api("/expression/review", { expression: $("#expr-word").textContent, sentence });
    $("#expr-result").innerHTML = `
      <div class="feedback ${r.corrections.length ? "" : "good"}">
        <div class="fb-title">📝 피드백 ${scoreBadge(r.score)}</div>
        ${correctionsHTML(r.corrections)}
        <div>💬 원어민이라면: <span class="fixed">${esc(r.natural_version)}</span></div>
        <div class="reason" style="margin-top:6px">${esc(r.comment)}</div>
      </div>`;
    $("#expr-next-row").classList.remove("hidden");
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "첨삭 받기";
  }
});

// ===== 공부량 =====
function statBlock(title, s) {
  return `
    <div class="card">
      <h3 style="margin-bottom:10px">${title}</h3>
      <div class="stat-row"><span>학습한 문장</span><b>${s.count}개</b></div>
      <div class="stat-row"><span>최근 10문장 평균</span><b>${s.avg10 ?? "-"}${s.avg10 != null ? "점" : ""}</b></div>
      <div class="stat-row"><span>최근 100문장 평균</span><b>${s.avg100 ?? "-"}${s.avg100 != null ? "점" : ""}</b></div>
      <div class="stat-row"><span>최근 점수</span><span>${s.recentScores.length ? s.recentScores.map(scoreBadge).join(" ") : "-"}</span></div>
    </div>`;
}

async function loadProgress() {
  const box = $("#progress-content");
  box.innerHTML = `<p class="muted">불러오는 중...</p>`;
  try {
    const p = await api("/progress");
    const writingHistory = p.writing.history
      .map(
        (h) => `<div class="history-item">
          <div class="hi-date">${new Date(h.ts).toLocaleString("ko-KR")} ${scoreBadge(h.score)}</div>
          <b>Q.</b> ${esc(h.question)}<br/><b>A.</b> ${esc(h.answer)}<br/>
          <b>교정:</b> ${esc(h.feedback.corrected_answer)}<br/>
          <b>모범 답안:</b> ${esc(h.feedback.native_answer)}
        </div>`
      )
      .join("");
    const exprHistory = p.expression.history
      .map(
        (h) => `<div class="history-item">
          <div class="hi-date">${new Date(h.ts).toLocaleString("ko-KR")} ${scoreBadge(h.score)}</div>
          <b>${esc(h.expression)}</b><br/>${esc(h.sentence)}
        </div>`
      )
      .join("");
    box.innerHTML = `
      ${statBlock("💬 회화", p.conversation)}
      ${statBlock("✍️ 글쓰기", p.writing)}
      ${statBlock("💡 표현", p.expression)}
      <details class="history"><summary>✍️ 글쓰기 피드백 기록 (${p.writing.history.length})</summary>${writingHistory || '<p class="muted">아직 기록이 없어요.</p>'}</details>
      <details class="history"><summary>💡 표현 학습 기록 (${p.expression.history.length})</summary>${exprHistory || '<p class="muted">아직 기록이 없어요.</p>'}</details>`;
  } catch (e) {
    box.innerHTML = `<p class="muted">${esc(e.message)}</p>`;
  }
}

// ===== 로그인 / 세션 =====
function showLoginGate({ configured = true } = {}) {
  $("#app").classList.add("hidden");
  $("#login-gate").classList.remove("hidden");
  $("#login-btn").classList.toggle("hidden", !configured);
  $("#login-unconfigured").classList.toggle("hidden", configured);
}

function showApp(me) {
  $("#login-gate").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#user-name").textContent = me.user.name;
  $("#andysnote-toggle").checked = Boolean(me.settings?.andysNoteLinked);
}

$("#logout-btn").addEventListener("click", async () => {
  try {
    await api("/auth/logout", {});
  } catch (e) {
    /* 실패해도 로그인 화면으로 보낸다 */
  }
  showLoginGate();
});

$("#finish-btn").addEventListener("click", async () => {
  const btn = $("#finish-btn");
  btn.disabled = true;
  try {
    const r = await api("/report/finish", {});
    toast(`드라이브에 저장했어요: ${r.file} (${r.count}문장)`);
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
});

$("#andysnote-toggle").addEventListener("change", async (ev) => {
  const linked = ev.target.checked;
  ev.target.disabled = true;
  try {
    await api("/report/andysnote", { linked });
    toast(linked ? "AndysNote 폴더로 연동했어요." : "연동을 해제했어요.");
  } catch (e) {
    ev.target.checked = !linked; // 롤백
    toast(e.message);
  } finally {
    ev.target.disabled = false;
  }
});

async function init() {
  if (new URLSearchParams(location.search).get("login") === "error") {
    $("#login-error").classList.remove("hidden");
    history.replaceState(null, "", location.pathname);
  }
  try {
    const me = await api("/auth/me");
    if (!me.configured) return showLoginGate({ configured: false });
    if (!me.user) return showLoginGate();
    showApp(me);
  } catch (e) {
    showLoginGate();
  }
}

init();
