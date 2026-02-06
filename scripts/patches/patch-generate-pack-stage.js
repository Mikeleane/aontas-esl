const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app/api/reading/generate-pack/route.tsx");
if (!fs.existsSync(file)) {
  console.error("Missing file:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");
const before = s;
const changed = [];

// 1) Ensure CEFR import is ONLY at the top (remove any stray copies)
const cefrImportLine = 'import { parseCefrLevel, cefrToStageBand } from "../../../../lib/cefr";';
const cefrImportRe = /^import\s+\{\s*parseCefrLevel\s*,\s*cefrToStageBand\s*\}\s+from\s+["'][^"']*lib\/cefr["'];\s*\r?\n/gm;
if (cefrImportRe.test(s)) {
  s = s.replace(cefrImportRe, "");
  changed.push("removed duplicate/misplaced CEFR imports");
}

// Insert import after the last top-of-file import
(function ensureImportAtTop() {
  const lines = s.split(/\r?\n/);
  let i = 0;

  // Skip "use server/client" if present
  if (/^\s*["']use (server|client)["'];?\s*$/.test(lines[i] || "")) i++;

  // Walk past import block and blank lines
  let insertAt = i;
  for (; insertAt < lines.length; insertAt++) {
    const line = lines[insertAt];
    if (/^\s*import\s/.test(line) || /^\s*$/.test(line)) continue;
    break;
  }

  // Find the last import line within that header region
  let lastImport = -1;
  for (let j = 0; j < insertAt; j++) {
    if (/^\s*import\s/.test(lines[j])) lastImport = j;
  }
  const where = lastImport >= 0 ? lastImport + 1 : i;

  // Only insert if not already present anywhere
  if (!s.includes(cefrImportLine)) {
    lines.splice(where, 0, cefrImportLine);
    s = lines.join("\n");
    changed.push("inserted CEFR import at top");
  }
})();

// 2) Remove ALL existing const stage / const cefrLevel declarations (we’ll re-add once, in the right place)
const stageDeclRe = /^\s*const\s+stage\s*=.*;\s*\r?\n/gm;
const cefrDeclRe  = /^\s*const\s+cefrLevel\s*=.*;\s*\r?\n/gm;

if (stageDeclRe.test(s)) {
  s = s.replace(stageDeclRe, "");
  changed.push("removed duplicate stage declarations");
}
if (cefrDeclRe.test(s)) {
  s = s.replace(cefrDeclRe, "");
  changed.push("removed duplicate cefrLevel declarations");
}

// 3) Insert ONE correct cefrLevel + stage block immediately after normalizeTeacherRequest(...)
function insertAfterAnchor(anchorRe, insertBlock) {
  const m = s.match(anchorRe);
  if (!m) return false;
  s = s.replace(anchorRe, (hit) => hit + insertBlock);
  return true;
}

const insertBlock =
`\n    // --- CEFR-first (fallback to B1), with legacy stage-band compatibility ---\n` +
`    const cefrLevel = parseCefrLevel((body as any)?.cefrLevel ?? (body as any)?.level ?? "B1");\n` +
`    const stage = Number.isFinite(Number((body as any)?.stage))\n` +
`      ? Number((body as any)?.stage)\n` +
`      : cefrToStageBand(cefrLevel);\n`;

const anchored =
  insertAfterAnchor(/(\bconst\s+body\s*=\s*normalizeTeacherRequest\([^\)]*\)\s*;\s*\r?\n)/m, insertBlock) ||
  insertAfterAnchor(/(\bconst\s+body\s*=\s*normalizeTeacherRequest\([^\)]*\)\s*;\s*)/m, "\n" + insertBlock) ||
  insertAfterAnchor(/(\bconst\s+body\s*=\s*[^\r\n;]+;\s*\r?\n)/m, insertBlock);

if (anchored) changed.push("inserted single cefrLevel+stage block after body normalization");
else {
  console.warn("⚠️ Could not find a body normalization anchor to insert cefrLevel/stage. No insertion made.");
}

// 4) Save if changed
if (s !== before) {
  fs.writeFileSync(file, s, "utf8");
  console.log("✅ Patched generate-pack route:");
  changed.forEach(x => console.log(" -", x));
} else {
  console.log("ℹ️ No changes needed in generate-pack route.");
}
