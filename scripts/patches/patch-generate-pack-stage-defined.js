/**
 * Fix runtime "stage is not defined" in generate-pack route
 * Strategy:
 *  - Insert a single, always-defined CEFR/stage/schoolClass spine right after body normalization
 *  - Convert any later "const stage/cefrLevel/schoolClass/klass" into assignments so they reuse the spine
 */
const fs = require("fs");

const file = "app/api/reading/generate-pack/route.tsx";
if (!fs.existsSync(file)) {
  console.error("Missing:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
fs.writeFileSync(file + ".bak_" + stamp, s, "utf8");

const marker = "CEFR/stage spine (always define before prompts)";
let changed = false;

// Insert spine after normalizeTeacherRequest(...)
if (!s.includes(marker)) {
  const re = /(const\s+body\s*=\s*normalizeTeacherRequest\([^\)]*\);\s*)/;
  if (re.test(s)) {
    s = s.replace(
      re,
      `$1\n    // --- ${marker} ---\n` +
      `    let cefrLevel = parseCefrLevel((body as any)?.meta?.cefrLevel ?? (body as any)?.cefrLevel ?? (body as any)?.level ?? "B1");\n` +
      `    let stage = Number.isFinite(Number((body as any)?.meta?.stage ?? (body as any)?.stage))\n` +
      `      ? Number((body as any)?.meta?.stage ?? (body as any)?.stage)\n` +
      `      : cefrToStageBand(cefrLevel);\n` +
      `    let schoolClass = Number.isFinite(Number((body as any)?.meta?.schoolClass ?? (body as any)?.schoolClass))\n` +
      `      ? Number((body as any)?.meta?.schoolClass ?? (body as any)?.schoolClass)\n` +
      `      : stage;\n` +
      `    let klass = schoolClass;\n`
    );
    changed = true;
  } else {
    console.error("Anchor not found: const body = normalizeTeacherRequest(...);");
    console.error("Patch NOT applied (backup still written):", file + ".bak_" + stamp);
    process.exit(2);
  }
}

// Convert later const declarations into assignments (so they reuse the spine)
const before = s;
s = s.replace(/\bconst\s+cefrLevel\s*=\s*parseCefrLevel\s*\(/g, "cefrLevel = parseCefrLevel(");
s = s.replace(/\bconst\s+stage\s*=\s*/g, "stage = ");
s = s.replace(/\bconst\s+schoolClass\s*=\s*/g, "schoolClass = ");
s = s.replace(/\bconst\s+klass\s*=\s*/g, "klass = ");

if (s !== before) changed = true;

if (changed) {
  fs.writeFileSync(file, s, "utf8");
  console.log("✅ Patched:", file);
  console.log("🧷 Backup:", file + ".bak_" + stamp);
} else {
  console.log("No changes needed:", file);
  console.log("🧷 Backup:", file + ".bak_" + stamp);
}
