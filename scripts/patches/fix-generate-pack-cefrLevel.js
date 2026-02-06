const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "api", "reading", "generate-pack", "route.tsx");
if (!fs.existsSync(file)) {
  console.error("Missing:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");
const eol = s.includes("\r\n") ? "\r\n" : "\n";
const changed = [];

// 1) Ensure cefrLevel exists in-scope (only if missing)
if (!/\bconst\s+cefrLevel\b/.test(s)) {
  // Best anchor: right after normalizeTeacherRequest(...)
  const anchor = /const\s+body\s*=\s*normalizeTeacherRequest\([^\)]*\);\s*/m;
  if (anchor.test(s)) {
    s = s.replace(anchor, (m) =>
      m +
      `  const cefrLevel = parseCefrLevel((body as any)?.meta?.cefrLevel ?? (body as any)?.cefrLevel ?? (body as any)?.level ?? "B1");` +
      eol
    );
    changed.push("inserted cefrLevel after normalizeTeacherRequest");
  } else {
    // Fallback: after JSON parse / rawBody assignment
    const anchor2 = /const\s+rawBody\s*=\s*await\s+req\.json\(\);\s*/m;
    if (anchor2.test(s)) {
      s = s.replace(anchor2, (m) =>
        m +
        `  const cefrLevel = parseCefrLevel((rawBody as any)?.meta?.cefrLevel ?? (rawBody as any)?.cefrLevel ?? (rawBody as any)?.level ?? "B1");` +
        eol
      );
      changed.push("inserted cefrLevel after req.json()");
    }
  }
}

// 2) If cefrLevel is referenced in template strings, this alone fixes the runtime crash.
// (We’re not changing stage logic here; just preventing ReferenceError.)

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched generate-pack cefrLevel:", changed.length ? changed.join(", ") : "no changes needed");
