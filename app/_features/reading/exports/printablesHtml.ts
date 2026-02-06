import type { ExerciseItem, ExerciseSide, ReadingMode, ReadingPackData } from "../readingPackTypes";

export function splitParas(text: string) {
  const t = (text || "").replace(/\r/g, "").trim();
  if (!t) return [];

  const paras = t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length > 1) return paras;

  const lines = t
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;

  const sentenceMatches = t.match(/[^.!?]+[.!?]+(\s+|$)/g);
  const sentences = (sentenceMatches?.length ? sentenceMatches : [t])
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  let buf: string[] = [];
  let wc = 0;

  const pushBuf = () => {
    const p = buf.join(" ").replace(/\s+/g, " ").trim();
    if (p) out.push(p);
    buf = [];
    wc = 0;
  };

  for (const s of sentences) {
    const words = s.split(/\s+/).filter(Boolean);
    if (wc + words.length > 70 && buf.length) pushBuf();
    buf.push(s);
    wc += words.length;
    if (wc >= 70) pushBuf();
  }
  if (buf.length) pushBuf();

  return out.length ? out : [t];
}

function escapeHtmlInline(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function norm(v: any) {
  return v == null ? "" : String(v);
}

function getSide(item: ExerciseItem, mode: ReadingMode): ExerciseSide {
  if (mode === "standard") return item.standard;
  return item.SUPPORTED || item.adapted || item.standard;
}

function getCorrectIndex(item: ExerciseItem) {
  try {
    if (item.answerIndex != null) return Number(item.answerIndex);
    const stdOpts = item.standard?.options || [];
    const ans = item.answer;
    if (ans == null || Array.isArray(ans)) return -1;
    return stdOpts.map(norm).indexOf(norm(ans));
  } catch {
    return -1;
  }
}

function getDisplayAnswer(item: ExerciseItem, side: ExerciseSide) {
  try {
    const ans = item.answer;
    if (Array.isArray(ans)) return ans.join("; ");
    const idx = getCorrectIndex(item);
    const opts = side?.options || [];
    if (idx >= 0 && idx < opts.length) return String(opts[idx]);
    return norm(ans);
  } catch {
    return "";
  }
}

export function buildPrintablesHtml(pack: ReadingPackData, mode: ReadingMode, includeAnswers: boolean) {
  const title = pack.title || "Reading Pack";
  const label = mode === "standard" ? "Student A (Standard)" : "Student B (Supported)";
  const reading = pack.reading?.[mode] || "";
  const paras = splitParas(reading);

  const fontSize = mode === "SUPPORTED" ? 16 : 12;
  const lineHeight = mode === "SUPPORTED" ? 1.6 : 1.4;

  const exercises = pack.exercises || [];

  const crestImg = pack.crest
    ? `<img class="crest" src="${pack.crest}" alt="School crest" />`
    : `<div class="crest placeholder"></div>`;

  const exerciseHtml = exercises
    .map((it, i) => {
      const side = getSide(it, mode);
      const prompt = side?.prompt || "";
      const opts = side?.options || [];
      const ans = includeAnswers ? getDisplayAnswer(it, side) : "";

      if (opts.length) {
        const optList = opts
          .map((o, idx) => {
            const letter = String.fromCharCode(65 + idx);
            return `<div class="opt"><span class="letter">${letter}.</span> <span>${escapeHtmlInline(o)}</span></div>`;
          })
          .join("");

        return `
<section class="q">
  <div class="qhead">
    <div class="qnum">${i + 1}.</div>
    <div class="qprompt">${escapeHtmlInline(prompt)}</div>
  </div>
  <div class="opts">${optList}</div>
  ${includeAnswers ? `<div class="ans"><b>Answer:</b> ${escapeHtmlInline(ans)}</div>` : `<div class="line"></div>`}
</section>`;
      }

      return `
<section class="q">
  <div class="qhead">
    <div class="qnum">${i + 1}.</div>
    <div class="qprompt">${escapeHtmlInline(prompt)}</div>
  </div>
  ${includeAnswers ? `<div class="ans"><b>Answer:</b> ${escapeHtmlInline(ans)}</div>` : `<div class="lines">
    <div class="line"></div><div class="line"></div><div class="line"></div>
  </div>`}
</section>`;
    })
    .join("");

  const readingHtml = paras.map((p) => `<p class="p">${escapeHtmlInline(p)}</p>`).join("");
  const meta = `Class ${pack.schoolClass ?? ""} • Stage ${pack.stage ?? ""}`.replace(/•\s*$/, "").trim();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtmlInline(title)} — ${escapeHtmlInline(label)}</title>
<style>
  :root{
    --ink:#0f172a;
    --muted:#475569;
    --line:rgba(15,23,42,.18);
    --accent:#2d7d4f;
    --paper:#ffffff;
  }
  *{box-sizing:border-box}
  body{
    margin:0;
    color:var(--ink);
    background:var(--paper);
    font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
    font-size:${fontSize}px;
    line-height:${lineHeight};
  }
  .page{
    max-width:820px;
    margin:0 auto;
    padding:28px 26px 40px;
  }
  .header{
    display:flex;
    gap:14px;
    align-items:center;
    border-bottom:2px solid var(--line);
    padding-bottom:12px;
    margin-bottom:16px;
  }
  .crest{
    width:54px;height:54px;
    border-radius:14px;
    border:1px solid var(--line);
    object-fit:contain;
    padding:6px;
  }
  .crest.placeholder{background:#f1f5f9;}
  h1{margin:0;font-size:18px;line-height:1.2}
  .meta{color:var(--muted);font-size:12px;margin-top:4px}
  .tag{
    margin-left:auto;
    border:1px solid var(--line);
    padding:6px 10px;
    border-radius:999px;
    font-size:12px;
    font-weight:800;
    color:var(--accent);
    white-space:nowrap;
  }
  .blockTitle{
    margin:18px 0 10px;
    font-size:13px;
    font-weight:900;
    letter-spacing:.2px;
    text-transform:uppercase;
    color:var(--accent);
  }
  .p{margin:0 0 10px; text-align:left;}
  .q{margin:0 0 14px; padding:12px 12px; border:1px solid var(--line); border-radius:12px;}
  .qhead{display:flex; gap:10px; align-items:flex-start}
  .qnum{font-weight:900; min-width:28px}
  .qprompt{font-weight:800}
  .opts{margin-top:10px; display:flex; flex-direction:column; gap:8px}
  .opt{display:flex; gap:8px; align-items:flex-start}
  .letter{font-weight:900; min-width:26px}
  .lines{margin-top:10px}
  .line{height:18px; border-bottom:1px solid var(--line); margin-top:10px}
  .ans{margin-top:10px; padding-top:10px; border-top:1px dashed var(--line); font-size:12px}
  .teacherNote{
    margin-top:12px;
    font-size:12px;
    color:var(--muted);
  }

  @page{ size:A4; margin:14mm; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${crestImg}
      <div>
        <h1>${escapeHtmlInline(title)}</h1>
        <div class="meta">${escapeHtmlInline(meta)}${meta ? " • " : ""}${escapeHtmlInline(label)}</div>
        ${includeAnswers ? `<div class="teacherNote">Teacher key included (answers shown).</div>` : ``}
      </div>
      <div class="tag">${includeAnswers ? "Teacher Key" : "Printable"}</div>
    </div>

    <div class="blockTitle">Reading</div>
    ${readingHtml}

    <div class="blockTitle">Exercises</div>
    ${exerciseHtml}
  </div>
</body>
</html>`;
}

export function buildTeacherKeyHtml(pack: ReadingPackData) {
  return buildPrintablesHtml(pack, "standard", true);
}
