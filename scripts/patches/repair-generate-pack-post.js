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

function add(label){ changed.push(label); }

const importLine = 'import { parseCefrLevel, cefrToStageBand } from "../../../../lib/cefr";';

// 1) Remove ALL occurrences of the CEFR import (we’ll re-insert once, near the top)
let before = s;
s = s.replace(new RegExp("^\\s*" + importLine.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "\\s*\\r?\\n", "mg"), "");
if (s !== before) add("removed stray CEFR import(s)");

// 2) Re-insert CEFR import once, right after the first import line
if (!s.includes(importLine)) {
  const m = s.match(/^import .*$/m);
  if (m && m.index != null) {
    const lineStart = m.index;
    const lineEnd = s.indexOf(eol, lineStart);
    const insertAt = lineEnd === -1 ? s.length : lineEnd + eol.length;
    s = s.slice(0, insertAt) + importLine + eol + s.slice(insertAt);
    add("inserted CEFR import near top");
  } else {
    // fallback: just prepend it
    s = importLine + eol + s;
    add("prepended CEFR import");
  }
}

// 3) Fix broken POST handler signature:
// If there is no valid POST export, replace a naked "(req: Request) {" line with a proper function header
const hasPost =
  /export\s+async\s+function\s+POST\b/.test(s) ||
  /export\s+function\s+POST\b/.test(s) ||
  /export\s+const\s+POST\b/.test(s);

if (!hasPost) {
  const re = /^\s*\(req\s*:\s*Request\)\s*\{\s*$/m;
  if (re.test(s)) {
    s = s.replace(re, "export async function POST(req: Request) {");
    add("repaired POST handler signature");
  }
}

// 4) If we *do* have export const POST but it’s missing =>, fix that too (rare, but your error hints at this)
s = s.replace(/^(\s*export\s+const\s+POST\s*=\s*async\s*)\((req\s*:\s*Request)\)\s*\{\s*$/m, "$1($2) => {");

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched generate-pack route:", changed.length ? changed.join(", ") : "no changes needed");
