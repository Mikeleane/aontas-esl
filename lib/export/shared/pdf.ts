/**
 * Shared jsPDF helpers (UI-independent).
 * Keep these tiny + defensive: PDF exports should never crash the app.
 */

export function pdfSafeText(t: any): string {
  // Handles both real Unicode punctuation AND common mojibake sequences ( -  etc)
  return String(t ?? "")
    // Unicode
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    // Mojibake (UTF-8 interpreted as Latin-1)
    .replace(/[- - ]/g, "-")
    .replace(/['']/g, "'")
    .replace(/["ï¿½]/g, '"')
    .replace(/.../g, "...")
    .replace(/"¢/g, "-");
}

export function pdfInferImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  const m = /^data:image\/([a-zA-Z0-9+.-]+);base64,/.exec(dataUrl || "");
  const t = (m?.[1] || "").toLowerCase();
  if (t.includes("png")) return "PNG";
  if (t.includes("webp")) return "WEBP";
  return "JPEG";
}

export function pdfAddCrest(doc: any, crestDataUrl: string, x: number, y: number, size: number) {
  try {
    const fmt = pdfInferImageFormat(crestDataUrl);
    doc.addImage(crestDataUrl, fmt, x, y, size, size);
  } catch {
    // Don't crash exports if addImage fails (rare)
  }
}

/**
 * Draw wrapped text and return the updated y cursor.
 * Uses jsPDF splitTextToSize and writes line-by-line to control line height.
 */
export function pdfAddWrapped(
  doc: any,
  text: any,
  x: number,
  y: number,
  maxW: number,
  lineH: number
) {
  const safe = pdfSafeText(text);
  const lines: string[] = doc.splitTextToSize(safe, maxW) || [];
  let yy = y;
  for (const line of lines) {
    doc.text(line, x, yy);
    yy += lineH;
  }
  return yy;
}
