/**
 * Shared text/binary helpers used across UI + exports.
 * Keep these pure and dependency-free.
 */

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

export function toText(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => toText(v)).filter(Boolean).join("\n");
  }
  if (typeof value === "object") {
    // Common cases: {text:"..."}, {content:"..."}, etc.
    const anyObj = value as any;
    if (typeof anyObj.text === "string") return anyObj.text;
    if (typeof anyObj.content === "string") return anyObj.content;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Convert a base64 data URL into bytes (for DOCX ImageRun, etc.) */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] || "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** JSON-safe for inline <script> usage (prevents </script> breakouts) */
export function safeSerializeForHtml(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/**
 * jsPDF default fonts are limited; normalize fancy punctuation to ASCII-ish.
 * Use this before adding text to PDFs when you don't have embedded fonts.
 */
export function pdfSafeText(t: any) {
  return String(t ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '\"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-");
}
