// 입력창에 타이핑을 시작한 순간부터 재는 경과 시간 타이머. 화면 전용 상태라 store에 남기지 않는다.
function paint(displays, startedAt) {
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  const label = `⏱ ${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  displays.forEach((el) => {
    el.textContent = label;
    el.classList.remove("hidden");
  });
}

/**
 * textareas 중 어느 하나에든 첫 입력이 들어오면 시작해, displays 각각에 같은 경과 시간을 보여 준다.
 * stop()은 인터벌만 멈추고(제출 시), reset()은 다음 문제로 넘어갈 때 시간·표시를 완전히 지운다.
 */
export function attachTypingTimer(textareas, displays) {
  let startedAt = null;
  let ticking = null;

  function stop() {
    clearInterval(ticking);
    ticking = null;
  }

  function onInput() {
    if (startedAt) return;
    startedAt = Date.now();
    paint(displays, startedAt);
    ticking = setInterval(() => paint(displays, startedAt), 1000);
  }

  textareas.forEach((el) => el.addEventListener("input", onInput));

  return {
    stop,
    reset() {
      stop();
      startedAt = null;
      displays.forEach((el) => {
        el.textContent = "";
        el.classList.add("hidden");
      });
    },
  };
}
