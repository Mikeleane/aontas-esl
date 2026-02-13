const fs = require("fs");
const path = require("path");

const target = path.join(process.cwd(), "app/api/reading/generate-pack/route.tsx");
if (!fs.existsSync(target)) {
  console.error("Missing:", target);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const bak = `${target}.bak_${stamp}`;
fs.copyFileSync(target, bak);

let s = fs.readFileSync(target, "utf8");
const before = s;

function ensureImport() {
  const imp = 'import { parseCefrLevel, cefrToStageBand } from "../../../../lib/cefr";';
  if (s.includes("parseCefrLevel") && s.includes("cefrToStageBand") && s.includes(imp)) return;

  // Only add if missing
  if (!s.includes(imp)) {
    const anchor = /import\s+\{\s*NextResponse\s*\}\s+from\s+"next\/server";\s*\r?\n/;
    if (anchor.test(s)) {
      s = s.replace(anchor, (m) => m + imp + "\n");
    } else {
      // fallback: insert after first import line
      const firstImport = s.match(/^import .*?\r?\n/m);
      if (firstImport) {
        const idx = firstImport.index + firstImport[0].length;
        s = s.slice(0, idx) + imp + "\n" + s.slice(idx);
      } else {
        s = imp + "\n" + s;
      }
    }
  }
}

ensureImport();

// 1) Convert any *existing* redeclarations to assignments so we can safely keep stage/cefrLevel in outer scope.
s = s.replace(/\b(const|let)\s+cefrLevel\s*=\s*parseCefrLevel\s*\(/g, "cefrLevel = parseCefrLevel(");
s = s.replace(/\b(const|let)\s+stage\s*=\s*/g, "stage = ");

// 2) Ensure POST() has outer-scope variables so stage/cefrLevel exist even if later code uses them outside a block.
const postRe = /export\s+async\s+function\s+POST\s*\(\s*req:\s*Request\s*\)\s*\{\s*/;
const m = s.match(postRe);

if (!m || typeof m.index !== "number") {
  console.error("Could not find: export async function POST(req: Request) {");
  console.error("Backup kept at:", bak);
  process.exit(1);
}

const insertPos = m.index + m[0].length;
const nearby = s.slice(insertPos, insertPos + 400);

if (!/\blet\s+cefrLevel\b/.test(nearby) && !/\blet\s+stage\b/.test(nearby)) {
  const inject =
`  // Keep these in outer scope so they are never "not defined" due to block scoping.
  let cefrLevel = "B1";
  let stage = 3;

`;
  s = s.slice(0, insertPos) + inject + s.slice(insertPos);
}

if (s !== before) {
  fs.writeFileSync(target, s, "utf8");
  console.log("✅ Patched generate-pack scoping. Backup:", bak);
} else {
  console.log("ℹ️ No changes needed in generate-pack. Backup:", bak);
}
