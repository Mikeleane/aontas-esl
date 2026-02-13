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
  answer: string | string[];
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

export function buildReadingTeacherKeyPdf(args: {
  title: string;
  level: Level;
  schoolClass: SchoolClass;
  stage: Stage;
  standardText: string;
  adaptedText: string;
  exercises: ExerciseItem[];
}): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;

  let y = margin;

  const addPageIfNeeded = (extra = 12) => {
    if (y + extra > pageH - margin) {
      doc.addPage();
      y = margin;
      pdfAddCrest(doc, KNS_CREST_DATA_URL, pageW - margin - 16, margin - 2, 16);
    }
  };

  // Page 1 crest
  pdfAddCrest(doc, KNS_CREST_DATA_URL, pageW - margin - 16, margin - 2, 16);

  doc.setFontSize(16);
  doc.setTextColor(20, 25, 35);
  doc.text(pdfSafeText("Teacher Key - Reading Pack"), margin, y);
  y += 7;

  doc.setFontSize(11);
  doc.text(
    pdfSafeText(`${args.title} • ${classLabel(args.schoolClass)} • ${stageLabel(args.stage)}`),
    margin,
    y
  );
  y += 6;

  doc.setFontSize(10);
  y = pdfAddWrapped(
    doc,
    "Answer key is shared across Standard and Adapted. Adapted supports access (layout, spacing, cues) without changing targets.",
    margin,
    y,
    maxW,
    4.6
  );
  y += 4;

  doc.setFontSize(12);
  doc.text("Answer Key", margin, y);
  y += 6;

  doc.setFontSize(10);
  args.exercises.forEach((q, idx) => {
    addPageIfNeeded(14);
    const head = toText(q.standard?.prompt).split("\n")[0].trim();
    y = pdfAddWrapped(doc, `${idx + 1}. ${head}`, margin, y, maxW, 4.6);
    const ans = q.answer;
    const ansText = Array.isArray(ans) ? ans.join("; ") : String(ans);
    y = pdfAddWrapped(doc, `Answer: ${ansText}`, margin + 2, y, maxW - 2, 4.6);
    y += 3;
  });

  addPageIfNeeded(20);
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFontSize(12);
  doc.text("Texts (reference)", margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.text("STANDARD", margin, y);
  y += 5;

  for (const p of splitParasForDoc(args.standardText)) {
    addPageIfNeeded(14);
    y = pdfAddWrapped(doc, p, margin, y, maxW, 4.6);
    y += 3;
  }

  addPageIfNeeded(16);
  doc.setFontSize(10);
  doc.text("ADAPTED", margin, y);
  y += 5;

  for (const p of splitParasForDoc(args.adaptedText)) {
    addPageIfNeeded(14);
    y = pdfAddWrapped(doc, p, margin, y, maxW, 4.6);
    y += 3;
  }

  return doc.output("blob");
}
