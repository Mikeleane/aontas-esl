// scripts/patches/patch-generate-pack-stage-duplicate.js
// Fix: generate-pack route defines `const stage` twice. Remove the later legacy line.

const fs = require("fs");

const target = "app/api/reading/generate-pack/route.tsx";
if (!fs.existsSync(target)) {
  console.log("Missing:", target);
  process.exit(0);
}

let s = fs.readFileSync(target, "utf8");
const before = s;

// Remove the legacy duplicate line that causes: "stage is defined multiple times"
const dupLine = /^\s*const\s+stage\s*=\s*body\.stage\s*\?\?\s*3\s*;\s*$/m;

if (dupLine.test(s)) {
  s = s.replace(dupLine, "    // stage is computed earlier (CEFR/stage-band); legacy duplicate removed");
}

// If it still exists more than once, do a safer fallback rename
const stageDecls = (s.match(/\bconst\s+stage\s*=/g) || []).length;
if (stageDecls > 1) {
  // Rename the *later* occurrence of `const stage = ...` (very targeted)
  const idx = s.lastIndexOf("const stage =");
  if (idx >= 0) {
    s = s.slice(0, idx) + s.slice(idx).replace("const stage =", "const stageLegacy =");
  }
}

if (s !== before) {
  fs.writeFileSync(target, s, "utf8");
  console.log("Patched:", target);
} else {
  console.log("No changes needed:", target);
}
