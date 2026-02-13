/**
 * Patch: app/api/reading/generate-pack/route.tsx
 * Goals:
 *  - Ensure CEFR import is ONLY at top (remove stray mid-file imports).
 *  - Ensure cefrLevel + stage are computed inside POST handler.
 *  - Remove any module-scope references to stageTargets(stage) / stage usage before POST.
 *  - Rename legacy duplicate `const stage = body.stage ?? 3;` to `stageLegacy` to avoid redeclare.
 */
const fs = require("fs");

const file = "app/api/reading/generate-pack/route.tsx";
if (!fs.existsSync(file)) {
  console.error("Missing:", file);
  process.exit(1);
}
let s = fs.readFileSync(file, "utf8");
const before = s;

const cefrImportLine = 'import { parseCefrLevel, cefrToStageBand } from "../../../../lib/cefr";';

// 1) Remove ANY existing cefr imports (wherever they are), we’ll re-add once at top
s = s.replace(/^\s*import\s*\{\s*parseCefrLevel\s*,\s*cefrToStageBand\s*\}\s*from\s*["'][^"']*lib\/cefr["'];\s*\r?\n/gm, "");
s = s.replace(/^\s*import\s*\{\s*parseCefrLevel\s*\}\s*from\s*["'][^"']*lib\/cefr["'];\s*\r?\n/gm, "");
s = s.replace(/^\s*import\s*\{\s*cefrToStageBand\s*\}\s*from\s*["'][^"']*lib\/cefr["'];\s*\r?\n/gm, "");

// 2) Re-insert CEFR import after top import block
const m = s.match(/^(?:\s*import[^\n]*\r?\n)+/);
if (m) {
  s = s.slice(0, m[0].length) + cefrImportLine + "\n" + s.slice(m[0].length);
} else {
  s = cefrImportLine + "\n" + s;
}

// 3) Remove module-scope stageTargets(stage) usage BEFORE POST handler (this causes stage not defined)
const postIdx = s.search(/export\s+async\s+function\s+POST\b/);
if (postIdx > 0) {
  const head = s.slice(0, postIdx);
  const tail = s.slice(postIdx);

  // Kill common offenders that should never be module-scope
  const cleanedHead = head
    .replace(/^\s*const\s+targets\s*=\s*stageTargets\(stage\);\s*\r?\n/gm, "")
    .replace(/^\s*const\s+targets\s*=\s*stageTargets\(\s*stage\s*\);\s*\r?\n/gm, "")
    .replace(/^\s*\/\/.*stageTargets\(stage\).*?\r?\n/gm, (x) => x) // keep comments
  ;

  s = cleanedHead + tail;
}

// 4) Inside POST: ensure cefrLevel + stage exist (insert after normalizeTeacherRequest)
if (!/const\s+cefrLevel\s*=/.test(s) || !/const\s+stage\s*=/.test(s)) {
  const needle = "const body = normalizeTeacherRequest(rawBody);";
  const ins =
`\n    // --- CEFR-first (fallback to B1), with legacy stage-band compatibility ---
    const cefrLevel = parseCefrLevel((body as any)?.meta?.cefrLevel ?? (body as any)?.cefrLevel ?? (body as any)?.level ?? "B1");
    const stage = Number.isFinite(Number((body as any)?.meta?.stage ?? (body as any)?.stage))
      ? Number((body as any)?.meta?.stage ?? (body as any)?.stage)
      : cefrToStageBand(cefrLevel);\n`;

  if (s.includes(needle)) {
    s = s.replace(needle, needle + ins);
  } else {
    // fallback: insert after first occurrence of normalizeTeacherRequest(
    s = s.replace(/(normalizeTeacherRequest\([^\)]*\);\s*)/m, `$1${ins}`);
  }
}

// 5) Rename the classic duplicate legacy stage line to avoid "defined multiple times"
s = s.replace(/\bconst\s+stage\s*=\s*body\.stage\s*\?\?\s*3\s*;/g, "const stageLegacy = body.stage ?? 3;");
s = s.replace(/\bconst\s+stage\s*=\s*body\?\.stage\s*\?\?\s*3\s*;/g, "const stageLegacy = body?.stage ?? 3;");
s = s.replace(/\bconst\s+stage\s*=\s*body\?\.meta\?\.stage\s*\?\?\s*3\s*;/g, "const stageLegacy = body?.meta?.stage ?? 3;");
s = s.replace(/\bconst\s+stage\s*=\s*body\.meta\.stage\s*\?\?\s*3\s*;/g, "const stageLegacy = body.meta.stage ?? 3;");

// 6) If there are MULTIPLE `const stage =` left, keep the first and rename the rest (last-resort safety)
const matches = [...s.matchAll(/\bconst\s+stage\s*=\s*/g)];
if (matches.length > 1) {
  let seen = 0;
  s = s.replace(/\bconst\s+stage\s*=\s*/g, (m) => {
    seen++;
    return seen === 1 ? m : "const stage__dup__ = ";
  });
}

if (s !== before) {
  fs.writeFileSync(file, s, "utf8");
  console.log("Patched:", file);
} else {
  console.log("No changes needed:", file);
}
