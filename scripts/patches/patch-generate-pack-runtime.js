const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app/api/reading/generate-pack/route.tsx");
if (!fs.existsSync(file)) {
  console.error("Missing:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");
const before = s;
const changes = [];

function rmLineExact(word){
  const re = new RegExp(`^\\s*${word}\\s*$\\r?\\n`, "gm");
  if (re.test(s)) { s = s.replace(re, ""); changes.push(`removed stray line: ${word}`); }
}

// 1) Kill stray "removed" lines that can cause runtime ReferenceError
rmLineExact("removed");

// 2) Remove legacy duplicate stage assignment if present
const legacyStageRe = /^\s*const\s+stage\s*=\s*(body as any)?\.?stage\s*\?\?\s*3\s*;\s*\r?\n/gm;
if (legacyStageRe.test(s)) { s = s.replace(legacyStageRe, ""); changes.push("removed legacy: const stage = body.stage ?? 3;"); }

// 3) Ensure DEFAULT_CEFR exists if referenced in template strings
if (s.includes("DEFAULT_CEFR") && !/const\s+DEFAULT_CEFR\s*=/.test(s)) {
  // Insert after cefrLevel declaration if we can find it
  const anchor = /const\s+cefrLevel\s*=\s*parseCefrLevel\([^\)]*\)\s*;\s*\r?\n/;
  if (anchor.test(s)) {
    s = s.replace(anchor, (m) => m + `    const DEFAULT_CEFR = cefrLevel;\n`);
    changes.push("defined DEFAULT_CEFR = cefrLevel (so template strings don't crash)");
  } else {
    // fallback: define near top of POST if anchor not found
    s = s.replace(/export\s+async\s+function\s+POST\s*\([^\)]*\)\s*\{\s*\r?\n/, (m) =>
      m + `  const DEFAULT_CEFR = "B1";\n`
    );
    changes.push("defined fallback DEFAULT_CEFR = 'B1' near top of POST");
  }
}

// 4) Fix common mojibake in this file (harmless but nice)
const mojis = [
  ["â€™","’"],
  ["â€œ","“"],
  ["â€\u009d","”"],
  ["â€","”"],
  ["â€“","–"],
  ["â€¢","•"],
];
for (const [a,b] of mojis) {
  if (s.includes(a)) { s = s.split(a).join(b); }
}
changes.push("mojibake cleanup pass");

// Save if changed
if (s !== before) {
  fs.writeFileSync(file, s, "utf8");
  console.log("✅ Patched generate-pack route:");
  for (const c of changes) console.log(" -", c);
} else {
  console.log("ℹ️ No changes needed.");
}
