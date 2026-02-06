/**
 * Patch: app/api/reading/generate-pack/route.tsx
 * هدف: fix "stage is not defined" + duplicate stage declarations + ensure cefrLevel exists
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "app", "api", "reading", "generate-pack", "route.tsx");
if (!fs.existsSync(FILE)) {
  console.error("File not found:", FILE);
  process.exit(1);
}

let s = fs.readFileSync(FILE, "utf8");
const before = s;

// --- 1) Pull any misplaced CEFR import out of the middle of the file ---
s = s.replace(/^\s*import\s+\{\s*parseCefrLevel\s*,\s*cefrToStageBand\s*\}\s+from\s+["'][^"']+["'];\s*$/gm, "");

// --- 2) Ensure CEFR import exists at TOP import block ---
const cefrImport = `import { parseCefrLevel, cefrToStageBand } from "../../../../lib/cefr";`;

// Find end of initial import block
const lines = s.split(/\r?\n/);
let lastImportIdx = -1;
for (let i = 0; i < Math.min(lines.length, 200); i++) {
  const t = lines[i].trim();
  if (!t) continue;
  if (t.startsWith("//")) continue;
  if (t.startsWith("import ")) lastImportIdx = i;
  else break;
}
if (!s.includes(cefrImport)) {
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, cefrImport);
    s = lines.join("\n");
  } else {
    s = cefrImport + "\n" + s;
  }
}

// --- 3) If a broken "(req: Request) {" ever appears, repair it ---
if (!s.includes("export async function POST") && /\(\s*req\s*:\s*Request\s*\)\s*\{/.test(s)) {
  s = s.replace(/\(\s*req\s*:\s*Request\s*\)\s*\{/, "export async function POST(req: Request) {");
}

// --- 4) Ensure cefrLevel+stage are defined ONCE, early, in POST handler ---
// Replace the FIRST occurrence of: const stage = body.stage ?? 3;
const stageLineRe = /(^\s*const\s+stage\s*=\s*body\.stage\s*\?\?\s*3\s*;\s*$)/m;
if (stageLineRe.test(s)) {
  s = s.replace(stageLineRe,
`  const cefrLevel = parseCefrLevel((body as any)?.cefrLevel ?? (body as any)?.level ?? "B1");
  const stage = Number.isFinite(Number((body as any)?.stage))
    ? Number((body as any)?.stage)
    : cefrToStageBand(cefrLevel);`);
} else {
  // If that exact line isn't present, insert after normalizeTeacherRequest(...) if possible
  const normRe = /(const\s+body\s*=\s*normalizeTeacherRequest\([^)]+\)\s*;\s*)/;
  if (normRe.test(s) && !/\bconst\s+cefrLevel\b/.test(s)) {
    s = s.replace(normRe, `$1
    const cefrLevel = parseCefrLevel((body as any)?.cefrLevel ?? (body as any)?.level ?? "B1");
    const stage = Number.isFinite(Number((body as any)?.stage))
      ? Number((body as any)?.stage)
      : cefrToStageBand(cefrLevel);
`);
  }
}

// --- 5) Remove duplicate const stage / const cefrLevel later in the file (keep first) ---
function dropDuplicateConst(name) {
  let seen = false;
  const re = new RegExp(`^[\\t ]*const\\s+${name}\\s*=.*;\\s*\\r?\\n`, "gm");
  s = s.replace(re, (m) => {
    if (!seen) { seen = true; return m; }
    return "";
  });
}
dropDuplicateConst("cefrLevel");
dropDuplicateConst("stage");

// --- 6) Fix a few common mojibake bits (optional but helps UI/debug strings) ---
s = s
  .replace(/â€™/g, "’")
  .replace(/â€œ/g, "“")
  .replace(/â€/g, "”")
  .replace(/â€“/g, "–");

// --- write UTF-8 no BOM ---
if (s !== before) {
  fs.writeFileSync(FILE, s, { encoding: "utf8" });
  console.log("✅ Patched:", FILE);
} else {
  console.log("ℹ️ No changes needed:", FILE);
}
