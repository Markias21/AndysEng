// PDF에서 텍스트를 뽑는다. 외부 라이브러리 없이(이 프로젝트는 의존성 0개) 브라우저·Node에 모두
// 들어 있는 DecompressionStream("deflate")만 쓴다 — PDF의 FlateDecode가 곧 zlib이다.
//
// 쓰는 곳: BBC 6 Minute English 대본. BBC 대본은 저작물이라 레포에 담지 않고, 앱이 열 때 브라우저가
// downloads.bbc.co.uk에서 PDF를 직접 받아 여기서 텍스트로 푼다.
//
// 완전한 PDF 구현이 아니라 "BBC 학습 자료 PDF에서 글자를 읽는" 최소 구현이다. 대상 PDF는 전 회차가
// PDF 1.3 / FlateDecode / TrueType + MacRomanEncoding / 오브젝트 스트림 없음으로 규격이 같다.
// 규격이 다른 PDF를 만나면 조용히 빈 결과를 주지 말고 throw 한다(호출부가 폴백 화면을 띄운다).

// 바이트 ↔ 문자를 1:1로 맞춘 문자열. TextDecoder("latin1")은 windows-1252로 해석돼 0x80~0x9F가
// 어긋나므로 쓰지 않는다 — 여기서는 문자열 인덱스가 곧 바이트 오프셋이어야 한다.
function toLatin1(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return out;
}

// MacRomanEncoding 0x80~0xFF. 이게 없으면 –(0xD0), …(0xC9), ’(0xD5)가 Ð É Õ로 나온다.
// 정확히 128자여야 한다 — 0xCA(비분리 공백)나 0xF0(애플 로고)처럼 눈에 안 띄는 자리를 하나라도
// 빠뜨리면 그 뒤가 통째로 한 칸씩 밀려 –가 —로 나온다(실제로 그랬다). 테스트가 길이를 검사한다.
const MAC_ROMAN_HIGH =
  "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü" +
  "†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø" +
  "¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ" +
  "‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";

/** MacRoman 바이트열(1:1 latin1 문자열로 들고 있는 것)을 유니코드 문자열로. */
export function decodeMacRoman(raw) {
  let out = "";
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    out += code < 0x80 ? ch : MAC_ROMAN_HIGH[code - 0x80] ?? ch;
  }
  return out;
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * PDF 바이트에서 콘텐츠 스트림 문자열들을 뽑는다(압축은 풀고, 텍스트 연산자가 없는 것은 버린다).
 * /Length가 딕셔너리에 숫자로 박혀 있으면 그것을 쓰고, 아니면 다음 endstream까지로 본다.
 */
async function contentStreams(bytes) {
  const raw = toLatin1(bytes);
  const streams = [];
  for (const m of raw.matchAll(/stream\r?\n/g)) {
    const start = m.index + m[0].length;
    const dict = raw.slice(Math.max(0, m.index - 300), m.index);
    const declared = Number(dict.match(/\/Length\s+(\d+)/)?.[1]);
    const end = Number.isFinite(declared) && declared > 0 ? start + declared : raw.indexOf("endstream", start);
    if (end < 0) continue;

    // 이미지·폰트 스트림은 /Subtype으로 걸러 낸다. 이걸 빼면 1MB짜리 이미지 바이트열이 토크나이저에
    // 들어가 메모리를 다 쓴다(실제로 겪었다).
    if (/\/Subtype\s*\//.test(dict)) continue;

    const body = bytes.subarray(start, end);
    let text;
    try {
      text = /\/Filter\s*\/?\[?\s*\/?FlateDecode/.test(dict) ? toLatin1(await inflate(body)) : toLatin1(body);
    } catch {
      continue; // 이미지·폰트 스트림이 깨져 있어도 본문만 읽으면 된다.
    }
    if (isContentStream(text)) streams.push(text);
  }
  return streams;
}

/** 콘텐츠 스트림인지. 바이너리가 우연히 연산자 글자를 품는 경우가 있어 인쇄 가능 문자 비율도 본다. */
function isContentStream(text) {
  if (!text.includes("BT") || !(text.includes("Tj") || text.includes("TJ"))) return false;
  const sample = text.slice(0, 2000);
  const printable = sample.replace(/[^\t\r\n\x20-\x7e]/g, "").length;
  return printable / sample.length > 0.8;
}

// ── 콘텐츠 스트림 토크나이저 ──────────────────────────────────────────────
// 문자열 안에 이스케이프·중첩 괄호가 들어올 수 있어 정규식 대신 직접 훑는다.

const WHITESPACE = " \t\r\n\f\0";
const DELIMITER = "()<>[]{}/%";

function readString(src, i) {
  let depth = 1;
  let out = "";
  while (++i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      const next = src[++i];
      const octal = src.slice(i, i + 3).match(/^[0-7]{1,3}/);
      if (octal) {
        out += String.fromCharCode(parseInt(octal[0], 8));
        i += octal[0].length - 1;
      } else {
        out += { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[next] ?? next ?? "";
      }
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")" && --depth === 0) return [out, i + 1];
    out += ch;
  }
  return [out, i];
}

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (WHITESPACE.includes(ch)) {
      i += 1;
    } else if (ch === "%") {
      i = src.indexOf("\n", i) + 1 || src.length;
    } else if (ch === "(") {
      const [value, next] = readString(src, i);
      tokens.push({ type: "str", value });
      i = next;
    } else if (ch === "<" || ch === ">") {
      // 딕셔너리(<< >>)와 16진 문자열. BBC 대본은 16진 문자열을 쓰지 않아 내용은 버린다.
      i = src[i + 1] === ch ? i + 2 : (src.indexOf(">", i) + 1 || src.length);
    } else if (ch === "[" || ch === "]") {
      tokens.push({ type: ch });
      i += 1;
    } else if (ch === "/") {
      let j = i + 1;
      while (j < src.length && !WHITESPACE.includes(src[j]) && !DELIMITER.includes(src[j])) j += 1;
      tokens.push({ type: "name", value: src.slice(i + 1, j) });
      i = j;
    } else if (/[-+.\d]/.test(ch)) {
      let j = i;
      while (j < src.length && /[-+.\d]/.test(src[j])) j += 1;
      tokens.push({ type: "num", value: Number(src.slice(i, j)) || 0 });
      i = j;
    } else {
      let j = i;
      while (j < src.length && !WHITESPACE.includes(src[j]) && !DELIMITER.includes(src[j])) j += 1;
      tokens.push({ type: "op", value: src.slice(i, j) });
      i = j;
    }
  }
  return tokens;
}

// ── 텍스트 배치 ───────────────────────────────────────────────────────────
// 회전·기울임이 없는 문서라 행렬의 a(가로 배율)·d(세로 배율)·e,f(이동)만 쓴다.

// PDF 행렬 곱(행벡터 규약, m을 n에 적용): [a b c d e f]에서 b·c가 0이므로 네 항만 남는다.
const mul = (m, n) => [m[0] * n[0], 0, 0, m[3] * n[3], m[4] * n[0] + n[4], m[5] * n[3] + n[5]];
// 커닝은 ±2 수준이라 그대로 붙이면 되지만, 큰 음수는 실제 띄어쓰기를 대신하는 경우가 있다.
const KERN_AS_SPACE = -200;

/** 콘텐츠 스트림 문자열 → 배치된 텍스트 조각 [{x, y, text}]. 순수 함수. */
export function textRuns(content) {
  const runs = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let tm = [1, 0, 0, 1, 0, 0];
  let tlm = tm;
  let leading = 0;
  let operands = [];

  const place = (text) => {
    if (!text) return;
    const m = mul(tm, ctm);
    runs.push({ x: m[4], y: m[5], text: decodeMacRoman(text) });
  };
  const nextLine = (tx, ty) => {
    tlm = mul([1, 0, 0, 1, tx, ty], tlm);
    tm = tlm;
  };

  for (const token of tokenize(content)) {
    if (token.type !== "op") {
      operands.push(token);
      continue;
    }
    const nums = operands.filter((t) => t.type === "num").map((t) => t.value);
    switch (token.value) {
      case "q":
        stack.push(ctm);
        break;
      case "Q":
        ctm = stack.pop() ?? ctm;
        break;
      case "cm":
        if (nums.length === 6) ctm = mul([nums[0], 0, 0, nums[3], nums[4], nums[5]], ctm);
        break;
      case "BT":
        tm = tlm = [1, 0, 0, 1, 0, 0];
        break;
      case "Tm":
        if (nums.length === 6) tm = tlm = [nums[0], 0, 0, nums[3], nums[4], nums[5]];
        break;
      case "TL":
        leading = nums[0] ?? leading;
        break;
      case "TD":
        leading = -(nums[1] ?? 0);
      // fallthrough — TD는 leading을 정한 뒤 Td와 같다.
      case "Td":
        nextLine(nums[0] ?? 0, nums[1] ?? 0);
        break;
      case "T*":
        nextLine(0, -leading);
        break;
      case "Tj":
      case "'":
      case '"':
        if (token.value !== "Tj") nextLine(0, -leading);
        place(operands.filter((t) => t.type === "str").pop()?.value);
        break;
      case "TJ": {
        let text = "";
        for (const item of operands) {
          if (item.type === "str") text += item.value;
          else if (item.type === "num" && item.value <= KERN_AS_SPACE) text += " ";
        }
        place(text);
        break;
      }
      default:
        break;
    }
    operands = [];
  }
  return runs;
}

// 같은 줄로 볼 세로 오차(pt). 본문 글자 크기가 10pt 안팎이라 이 정도면 충분하다.
const LINE_TOLERANCE = 2;

/**
 * 텍스트 조각들을 줄로 묶는다. 같은 y = 한 줄(x 순서로 이어 붙임), 위에서 아래로.
 * 줄 간격이 평소보다 크게 벌어지면 문단 경계로 보고 빈 줄을 하나 끼운다.
 *
 * 이 y 묶음이 핵심이다 — 없으면 커닝 때문에 한 단어가 "word / - / for / - / word"처럼 쪼개진다.
 */
export function runsToLines(runs) {
  const groups = [];
  for (const run of [...runs].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.y - run.y) <= LINE_TOLERANCE) last.runs.push(run);
    else groups.push({ y: run.y, runs: [run] });
  }

  const gaps = groups.slice(1).map((g, i) => groups[i].y - g.y);
  // 짝수 개일 때 아래쪽 중앙값을 쓴다 — 위쪽을 쓰면 줄이 몇 개 없는 페이지에서 기준이 문단 간격까지
  // 끌려 올라가 경계를 하나도 못 잡는다.
  const median = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor((gaps.length - 1) / 2)] : 0;

  const lines = [];
  groups.forEach((group, i) => {
    if (i && median > 0 && groups[i - 1].y - group.y > median * 1.7) lines.push("");
    const text = group.runs
      .sort((a, b) => a.x - b.x)
      .map((r) => r.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text) lines.push(text);
    else if (lines[lines.length - 1] !== "") lines.push("");
  });
  return lines;
}

/**
 * PDF 바이트 → 페이지별 줄 목록. [{lines: string[]}]
 * 텍스트를 하나도 못 찾으면 던진다 — 빈 화면 대신 폴백을 띄우기 위해서다.
 */
export async function pdfPages(buffer) {
  const pages = (await contentStreams(new Uint8Array(buffer))).map((content) => ({ lines: runsToLines(textRuns(content)) }));
  if (!pages.some((p) => p.lines.length)) throw new Error("PDF에서 글자를 찾지 못했습니다.");
  return pages;
}
