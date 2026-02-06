import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from "docx";
import type { ExerciseItem, ReadingMode, ReadingPackData } from "../readingPackTypes";
import { splitParas } from "./printablesHtml";

type DocxOpts = { mode: ReadingMode; includeAnswers: boolean };

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

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const m = String(dataUrl || "").match(/^data:(.+?);base64,(.+)$/);
    if (!m) return null;
    const bin = atob(m[2]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export async function buildPrintablesDocxBlob(pack: ReadingPackData, opts: DocxOpts): Promise<Blob> {
  const isB = opts.mode === "SUPPORTED";
  const bodySize = isB ? 26 : 22; // half-points (docx uses half-points)
  const headingSize = 30;

  const label = opts.mode === "standard" ? "Student A (Standard)" : "Student B (Supported)";
  const meta = `Class ${pack.schoolClass ?? ""} • Stage ${pack.stage ?? ""}`.replace(/•\s*$/, "").trim();

  const children: Paragraph[] = [];

  // Header block (crest + title)
  const crestBytes = pack.crest?.startsWith("data:") ? dataUrlToUint8Array(pack.crest) : null;
  if (crestBytes) {
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: crestBytes,
            transformation: { width: 54, height: 54 },
          }),
          new TextRun({ text: "  " }),
          new TextRun({ text: pack.title || "Reading Pack", bold: true, size: headingSize }),
        ],
      })
    );
  } else {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: pack.title || "Reading Pack", bold: true, size: headingSize })],
      })
    );
  }

  children.push(
    new Paragraph({
      children: [new TextRun({ text: `${meta}${meta ? " • " : ""}${label}`, size: 20, color: "475569" })],
    })
  );

  if (opts.includeAnswers) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Teacher key included (answers shown).", italics: true, size: 18, color: "475569" })],
      })
    );
  }

  children.push(new Paragraph({ text: "" }));

  // Reading
  children.push(
    new Paragraph({
      text: "READING",
      heading: HeadingLevel.HEADING_3,
    })
  );

  const reading = pack.reading?.[opts.mode] || "";
  for (const p of splitParas(reading)) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: p, size: bodySize })],
        alignment: AlignmentType.LEFT,
        spacing: { after: isB ? 220 : 160 },
      })
    );
  }

  children.push(new Paragraph({ text: "" }));

  // Exercises
  children.push(
    new Paragraph({
      text: "EXERCISES",
      heading: HeadingLevel.HEADING_3,
    })
  );

  const ex = pack.exercises || [];
  ex.forEach((item, idx) => {
    const side = getSide(item, opts.mode);
    const prompt = side?.prompt || "";
    const options = side?.options || [];

    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${idx + 1}. ${prompt}`, bold: true, size: bodySize })],
        spacing: { after: 120 },
      })
    );

    if (options.length) {
      options.forEach((opt, j) => {
        const letter = String.fromCharCode(65 + j) + ". ";
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `${letter}${opt}`, size: bodySize })],
            indent: { left: 360 },
            spacing: { after: 80 },
          })
        );
      });
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Write your answer:", italics: true, size: 18, color: "475569" })],
          indent: { left: 360 },
          spacing: { after: 80 },
        })
      );
    }

    if (opts.includeAnswers) {
      const ans = getDisplayAnswer(item, side);
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Answer: ${ans}`, size: 18, color: "475569" })],
          indent: { left: 360 },
          spacing: { after: 160 },
        })
      );
    } else {
      children.push(new Paragraph({ text: "______________________________", indent: { left: 360 }, spacing: { after: 160 } }));
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }, // half-points
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
