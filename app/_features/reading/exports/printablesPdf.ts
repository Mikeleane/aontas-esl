import { PDFDocument, StandardFonts } from "pdf-lib";
import type { ExerciseItem, ReadingMode, ReadingPackData } from "../readingPackTypes";
import { splitParas } from "./printablesHtml";

type PdfOpts = { mode: ReadingMode; includeAnswers: boolean };

function norm(v: any) {
  return v == null ? "" : String(v);
}

function getSide(item: ExerciseItem, mode: ReadingMode) {
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

function getDisplayAnswer(item: ExerciseItem, side: { options?: string[] }) {
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

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  try {
    const m = String(dataUrl || "").match(/^data:(.+?);base64,(.+)$/);
    if (!m) return null;
    const b64 = m[2];
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function wrapLines(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = cur + " " + words[i];
    const w = font.widthOfTextAtSize(next, fontSize);
    if (w <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = words[i];
    }
  }
  lines.push(cur);
  return lines;
}

export async function buildPrintablesPdfBytes(pack: ReadingPackData, opts: PdfOpts): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // A4 in points
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;

  const margin = 46;
  const contentW = PAGE_W - margin * 2;

  const isB = opts.mode === "SUPPORTED";
  const bodySize = isB ? 13 : 11;
  const lineGap = isB ? 6 : 5;
  const lineH = bodySize + lineGap;

  const titleSize = 16;
  const sectionSize = 12;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - margin;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - margin;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) newPage();
  };

  // Crest (optional)
  try {
    if (pack.crest && pack.crest.startsWith("data:")) {
      const bytes = dataUrlToBytes(pack.crest);
      if (bytes) {
        // Try PNG first, then JPG
        let img: any = null;
        try {
          img = await pdf.embedPng(bytes);
        } catch {
          img = await pdf.embedJpg(bytes);
        }
        const dim = img.scale(1);
        const target = 44;
        const scale = target / Math.max(dim.width, dim.height);
        const w = dim.width * scale;
        const h = dim.height * scale;
        page.drawImage(img, { x: margin, y: y - h, width: w, height: h });
      }
    }
  } catch {
    // ignore crest errors
  }

  // Title + meta
  const titleX = margin + 54;
  page.drawText(pack.title || "Reading Pack", { x: titleX, y: y - 18, size: titleSize, font: fontBold });
  const meta = `Class ${pack.schoolClass ?? ""}  •  Stage ${pack.stage ?? ""}`.replace(/•\s*$/, "").trim();
  page.drawText(`${meta}  •  ${opts.mode === "standard" ? "Student A (Standard)" : "Student B (Supported)"}`, {
    x: titleX,
    y: y - 36,
    size: 10,
    font,
  });

  y -= 56;

  // Reading section
  ensureSpace(30);
  page.drawText("READING", { x: margin, y: y, size: sectionSize, font: fontBold });
  y -= 18;

  const readingText = pack.reading?.[opts.mode] || "";
  const paras = splitParas(readingText);

  for (const p of paras) {
    const lines = wrapLines(p, font, bodySize, contentW);
    ensureSpace(lines.length * lineH + 10);
    for (const ln of lines) {
      page.drawText(ln, { x: margin, y: y, size: bodySize, font });
      y -= lineH;
    }
    y -= 6;
  }

  y -= 6;

  // Exercises section
  ensureSpace(30);
  page.drawText("EXERCISES", { x: margin, y: y, size: sectionSize, font: fontBold });
  y -= 18;

  const ex = pack.exercises || [];
  for (let i = 0; i < ex.length; i++) {
    const item = ex[i];
    const side = getSide(item, opts.mode);
    const prompt = `${i + 1}. ${side?.prompt || ""}`.trim();
    const optsArr = side?.options || [];

    const promptLines = wrapLines(prompt, fontBold, bodySize, contentW);
    ensureSpace(promptLines.length * lineH + 12);
    for (const ln of promptLines) {
      page.drawText(ln, { x: margin, y: y, size: bodySize, font: fontBold });
      y -= lineH;
    }

    if (optsArr.length) {
      for (let j = 0; j < optsArr.length; j++) {
        const letter = String.fromCharCode(65 + j) + ".";
        const optText = `${letter} ${optsArr[j]}`;
        const optLines = wrapLines(optText, font, bodySize, contentW - 12);
        ensureSpace(optLines.length * lineH + 6);
        for (const ln of optLines) {
          page.drawText(ln, { x: margin + 12, y: y, size: bodySize, font });
          y -= lineH;
        }
      }
      y -= 4;

      if (opts.includeAnswers) {
        const ans = getDisplayAnswer(item, side);
        const ansLines = wrapLines(`Answer: ${ans}`, font, 10, contentW);
        ensureSpace(ansLines.length * (10 + 4) + 8);
        for (const ln of ansLines) {
          page.drawText(ln, { x: margin + 12, y: y, size: 10, font });
          y -= 14;
        }
      } else {
        ensureSpace(14);
        page.drawText("______________________________", { x: margin + 12, y: y, size: 10, font });
        y -= 14;
      }
    } else {
      // Open response
      if (opts.includeAnswers) {
        const ans = getDisplayAnswer(item, side);
        const ansLines = wrapLines(`Answer: ${ans}`, font, 10, contentW);
        ensureSpace(ansLines.length * 14 + 8);
        for (const ln of ansLines) {
          page.drawText(ln, { x: margin + 12, y: y, size: 10, font });
          y -= 14;
        }
      } else {
        ensureSpace(14 * 3 + 8);
        page.drawText("______________________________", { x: margin + 12, y: y, size: 10, font });
        y -= 14;
        page.drawText("______________________________", { x: margin + 12, y: y, size: 10, font });
        y -= 14;
        page.drawText("______________________________", { x: margin + 12, y: y, size: 10, font });
        y -= 14;
      }
    }

    y -= 8;
  }

  return await pdf.save();
}
