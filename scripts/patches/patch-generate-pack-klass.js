/**
 * Patch generate-pack route so `klass` is always defined.
 * - If `schoolClass` exists: inserts `const klass = schoolClass;` right after it.
 * - Else: defines klass from body.meta.schoolClass/body.schoolClass with fallback 3.
 */
const fs = require("fs");

const file = "app/api/reading/generate-pack/route.tsx";
if (!fs.existsSync(file)) {
  console.error("Missing:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
fs.writeFileSync(file + ".bak_klass_" + stamp, s, "utf8");

const hasKlassDecl = /\b(let|const)\s+klass\b/.test(s);
if (hasKlassDecl) {
  console.log("✅ klass already declared. No change.");
  process.exit(0);
}

let changed = false;

// Try 1: after schoolClass declaration (best)
const schoolMatch = s.match(/^\s*(let|const)\s+schoolClass\b/m);
if (schoolMatch && schoolMatch.index != null) {
  const start = schoolMatch.index;
  const semi = s.indexOf(";", start);
  if (semi !== -1) {
    const insert = "\n  const klass = schoolClass;\n";
    s = s.slice(0, semi + 1) + insert + s.slice(semi + 1);
    changed = true;
    console.log("✅ Inserted `klass` after `schoolClass` declaration.");
  }
}

// Try 2: after `const body = normalizeTeacherRequest(...)` (fallback)
if (!changed) {
  const bodyMatch = s.match(/^\s*const\s+body\s*=\s*normalizeTeacherRequest\([^\)]*\);\s*$/m);
  if (bodyMatch && bodyMatch.index != null) {
    const start = bodyMatch.index;
    const semi = s.indexOf(";", start);
    if (semi !== -1) {
      const insert =
        "\n\n  // Ensure `klass` exists (legacy name used in prompts/logging)\n" +
        "  const klass = Number.isFinite(Number((body as any)?.meta?.schoolClass ?? (body as any)?.schoolClass))\n" +
        "    ? Number((body as any)?.meta?.schoolClass ?? (body as any)?.schoolClass)\n" +
        "    : 3;\n";
      s = s.slice(0, semi + 1) + insert + s.slice(semi + 1);
      changed = true;
      console.log("✅ Inserted `klass` after `body` normalization.");
    }
  }
}

// Try 3: absolute last resort — define near first use of `${klass}`
// (prevents runtime crash even if the structure is unusual)
if (!changed && s.includes("${klass}")) {
  const idx = s.indexOf("${klass}");
  const head = s.lastIndexOf("\n", idx);
  if (head !== -1) {
    const insert =
      "\n  // Ensure `klass` exists (legacy name used in templates)\n" +
      "  const klass = Number.isFinite(Number((body as any)?.meta?.schoolClass ?? (body as any)?.schoolClass))\n" +
      "    ? Number((body as any)?.meta?.schoolClass ?? (body as any)?.schoolClass)\n" +
      "    : 3;\n";
    s = s.slice(0, head) + insert + s.slice(head);
    changed = true;
    console.log("✅ Inserted `klass` near first `${klass}` usage.");
  }
}

if (!changed) {
  console.log("⚠️ Could not find a safe insertion point. No changes made.");
  process.exit(2);
}

fs.writeFileSync(file, s, "utf8");
console.log("🧷 Backup:", file + ".bak_klass_" + stamp);
console.log("✅ Patched:", file);
