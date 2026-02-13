import jsPDF from "jspdf";
import { toText } from "../../text/sanitize";
import { KNS_CREST_DATA_URL } from "../../branding/knsBrand";
import { pdfAddCrest, pdfAddWrapped, pdfSafeText } from "../shared/pdf";

type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type SchoolClass = 1 | 2 | 3 | 4 | 5 | 6;
type Stage = 1 | 2 | 3 | 4;

type ExerciseSide = { prompt: string; options?: string[] };
type ExerciseItem = {
  id: number;
  type?: string;
  skill?: string;
  answer?: string | string[];
  standard: ExerciseSide;
  adapted: ExerciseSide;
};

function classLabel(c: SchoolClass) {
  return `Class ${c}`;
}
function stageLabel(s: Stage) {
  return `Stage ${s}`;
}

function splitParasForDoc(text: string): string[] {
  return (text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function buildReadingStudentPdf(args: {
  title: string;
  level: Level;
  schoolClass: SchoolClass;
  stage: Stage;
  mode: "standard" | "adapted";
  readingText: string;
  exercises: ExerciseItem[];
}): Blob {
  const adapted = args.mode === "adapted";
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const margin = 11; // narrower margins = more writing room
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;

  pdfAddCrest(doc, KNS_CREST_DATA_URL, pageW - margin - 16, margin - 2, 16);

  let y = margin;

  const h1 = adapted ? 17 : 15;
  const h2 = adapted ? 14 : 12;
  const body = adapted ? 12.5 : 10.5;
  const line = adapted ? 6.0 : 4.8;

  const addPageIfNeeded = (extra = 12) => {
    if (y + extra > pageH - margin) {
      doc.addPage();
      y = margin;
      pdfAddCrest(doc, KNS_CREST_DATA_URL, pageW - margin - 16, margin - 2, 16);
    }
  };

  doc.setFontSize(h1);
  doc.setTextColor(15, 61, 118);
  doc.text("Aontas 10 - Reading Pack", margin, y);
  y += adapted ? 8 : 7;

  doc.setFontSize(body);
  doc.setTextColor(20, 25, 35);
  doc.text(
    pdfSafeText(
      `${args.title} - ${classLabel(args.schoolClass)} - ${stageLabel(args.stage)} - Student Sheet (${adapted ? "B" : "A"})`
    ),
    margin,
    y
  );
  y += adapted ? 7 : 6;

  doc.setDrawColor(191, 145, 39);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += adapted ? 7 : 5;

  doc.setFontSize(h2);
  doc.text("Reading", margin, y);
  y += adapted ? 7 : 6;

  doc.setFontSize(body);
  for (const p of splitParasForDoc(args.readingText)) {
    addPageIfNeeded(16);
    y = pdfAddWrapped(doc, p, margin, y, maxW, line);
    y += adapted ? 5 : 3.5;
  }

  addPageIfNeeded(18);
  doc.setFontSize(h2);
  doc.text("Exercises", margin, y);
  y += adapted ? 7 : 6;

  doc.setFontSize(adapted ? 11 : 9.5);
  y = pdfAddWrapped(
    doc,
    "Tick one option for MCQs. Use the lines to write your answers and notes.",
    margin,
    y,
    maxW,
    adapted ? 5.2 : 4.4
  );
  y += adapted ? 4 : 3;

  args.exercises.forEach((q, idx) => {
    const side = (q as any)[args.mode] as ExerciseSide;
    const prompt = toText(side?.prompt).trim();
    const opts = Array.isArray(side?.options) ? side.options : [];

    addPageIfNeeded(28);

    const promptLines = doc.splitTextToSize(`${idx + 1}. ${pdfSafeText(prompt)}`, maxW - 4) as string[];
    const boxH = promptLines.length * (adapted ? 6.2 : 5.0) + 6;

    doc.setDrawColor(170);
    doc.rect(margin, y, maxW, boxH);
    doc.setFontSize(adapted ? 12.5 : 10.5);
    doc.text(promptLines, margin + 2, y + (adapted ? 6 : 5));
    y += boxH + (adapted ? 4 : 3);

    doc.setFontSize(adapted ? 12 : 10);
    if (opts.length) {
      opts.forEach((o) => {
        addPageIfNeeded(10);
        y = pdfAddWrapped(doc, `[ ] ${pdfSafeText(o)}`, margin + 2, y, maxW - 2, line);
        y += 1;
      });
      y += 2;

      doc.setFontSize(adapted ? 11.5 : 9.5);
      y = pdfAddWrapped(doc, "Notes / evidence from the text:", margin + 2, y, maxW - 2, adapted ? 5.2 : 4.4);
      y += 1;

      doc.setFontSize(adapted ? 12 : 10);
      const noteLines = adapted ? 3 : 2;
      for (let i2 = 0; i2 < noteLines; i2++) {
        addPageIfNeeded(8);
        doc.text("______________________________________________", margin + 2, y);
        y += adapted ? 7 : 6;
      }
    } else {
      const answerLines = adapted ? 6 : 4;
      for (let i2 = 0; i2 < answerLines; i2++) {
        addPageIfNeeded(8);
        doc.text("______________________________________________", margin + 2, y);
        y += adapted ? 7 : 6;
      }
      y += 1;

      doc.setFontSize(adapted ? 11.5 : 9.5);
      y = pdfAddWrapped(doc, "Notes / evidence from the text:", margin + 2, y, maxW - 2, adapted ? 5.2 : 4.4);
      y += 1;

      doc.setFontSize(adapted ? 12 : 10);
      const noteLines = adapted ? 3 : 2;
      for (let i3 = 0; i3 < noteLines; i3++) {
        addPageIfNeeded(8);
        doc.text("______________________________________________", margin + 2, y);
        y += adapted ? 7 : 6;
      }
    }

    y += adapted ? 7 : 5;
  });

  return doc.output("blob");
}
