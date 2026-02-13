/**
 * Patch generate-pack: fix "cannot reassign const" for cefrLevel/stage
 */
const fs = require("fs");

const file = "app/api/reading/generate-pack/route.tsx";
if (!fs.existsSync(file)) {
  console.error("Missing:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");
const before = s;

// If we ever assign later, make declarations mutable.
s = s.replace(/\bconst\s+cefrLevel\s*=\s*parseCefrLevel\s*\(/g, "let cefrLevel = parseCefrLevel(");
s = s.replace(/\bconst\s+stage\s*=\s*Number\.isFinite\s*\(/g, "let stage = Number.isFinite(");

// If code has assignments but no declaration, convert the first assignment into a declaration.
if (/\bcefrLevel\s*=\s*parseCefrLevel\s*\(/.test(s) && !/\b(?:const|let)\s+cefrLevel\s*=/.test(s)) {
  s = s.replace(/\bcefrLevel\s*=\s*parseCefrLevel\s*\(/, "const cefrLevel = parseCefrLevel(");
}
if (/\bstage\s*=\s*Number\.isFinite\s*\(/.test(s) && !/\b(?:const|let)\s+stage\s*=/.test(s)) {
  s = s.replace(/\bstage\s*=\s*Number\.isFinite\s*\(/, "const stage = Number.isFinite(");
}

if (s !== before) {
  fs.writeFileSync(file, s, "utf8");
  console.log("Patched:", file);
} else {
  console.log("No changes needed:", file);
}
