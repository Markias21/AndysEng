// SVG 꺾은선그래프. 외부 라이브러리 없이 직접 그린다.
// points: [{label, value}] — value가 null인 점은 건너뛴다.

function escAttr(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

export function lineChartSVG(points, { height = 200, yMin, yMax, unit = "" } = {}) {
  const data = points.filter((p) => p.value != null);
  if (data.length === 0) {
    return `<p class="muted">아직 데이터가 없어요.</p>`;
  }
  const width = 640;
  const pad = { top: 16, right: 16, bottom: 26, left: 38 };
  const values = data.map((p) => p.value);
  let lo = yMin ?? Math.min(...values);
  let hi = yMax ?? Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }

  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => pad.top + innerH - ((v - lo) / (hi - lo)) * innerH;

  const coords = data.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
  const gridVals = [lo, (lo + hi) / 2, hi];
  const grid = gridVals
    .map(
      (v) =>
        `<line x1="${pad.left}" y1="${y(v).toFixed(1)}" x2="${width - pad.right}" y2="${y(v).toFixed(1)}" class="chart-grid"/>
         <text x="${pad.left - 6}" y="${(y(v) + 4).toFixed(1)}" class="chart-ylabel">${Math.round(v * 10) / 10}</text>`
    )
    .join("");

  const labelStep = Math.max(1, Math.ceil(data.length / 6));
  const xLabels = data
    .map((p, i) =>
      i % labelStep === 0 || i === data.length - 1
        ? `<text x="${x(i).toFixed(1)}" y="${height - 8}" class="chart-xlabel">${escAttr(p.label)}</text>`
        : ""
    )
    .join("");

  const dots = data
    .map(
      (p, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5" class="chart-dot"><title>${escAttr(p.label)}: ${p.value}${escAttr(unit)}</title></circle>`
    )
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img">
    ${grid}
    <polyline points="${coords.join(" ")}" class="chart-line"/>
    ${dots}
    ${xLabels}
  </svg>`;
}
