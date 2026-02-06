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

function note(x){ changed.push(x); }

const postIdx =
  s.search(/export\s+(default\s+)?async\s+function\s+POST\b|export\s+function\s+POST\b|export\s+const\s+POST\b/);

if (postIdx === -1) {
  console.error("Could not find POST handler in route.tsx");
  process.exit(1);
}

let pre = s.slice(0, postIdx);
let post = s.slice(postIdx);

// 1) Ensure DEFAULT_CEFR exists at top-level
if (!/\bconst\s+DEFAULT_CEFR\b/.test(pre)) {
  // Insert after API_KEY or after imports if no API_KEY
  if (/const\s+API_KEY\b/.test(pre)) {
    pre = pre.replace(/const\s+API_KEY[^\n]*\r?\n/, (m) => m + `const DEFAULT_CEFR = "B1";` + eol);
    note("added DEFAULT_CEFR after API_KEY");
  } else {
    // after last import
    const lastImport = pre.match(/(^import .*?\r?\n)+/m);
    if (lastImport) {
      pre = pre.replace(lastImport[0], lastImport[0] + `const DEFAULT_CEFR = "B1";` + eol);
      note("added DEFAULT_CEFR after imports");
    } else {
      pre = `const DEFAULT_CEFR = "B1";` + eol + pre;
      note("prepended DEFAULT_CEFR");
    }
  }
}

// 2) Replace any TOP-LEVEL references to cefrLevel with DEFAULT_CEFR (pre-POST only)
if (/\bcefrLevel\b/.test(pre)) {
  pre = pre.replace(/\bcefrLevel\b/g, "DEFAULT_CEFR");
  note("replaced top-level cefrLevel -> DEFAULT_CEFR");
}

// 3) Ensure POST computes cefrLevel (inside handler)
if (!/\bconst\s+cefrLevel\b/.test(post)) {
  // Prefer anchor after normalizeTeacherRequest(...)
  if (/const\s+body\s*=\s*normalizeTeacherRequest\([^\)]*\);\s*/m.test(post)) {
    post = post.replace(
      /const\s+body\s*=\s*normalizeTeacherRequest\([^\)]*\);\s*/m,
      (m) =>
        m +
        `  const cefrLevel = parseCefrLevel((body as any)?.meta?.cefrLevel ?? (body as any)?.cefrLevel ?? (body as any)?.level ?? DEFAULT_CEFR);` +
        eol
    );
    note("inserted cefrLevel after normalizeTeacherRequest");
  } else if (/const\s+rawBody\s*=\s*await\s+req\.json\(\);\s*/m.test(post)) {
    post = post.replace(
      /const\s+rawBody\s*=\s*await\s+req\.json\(\);\s*/m,
      (m) =>
        m +
        `  const cefrLevel = parseCefrLevel((rawBody as any)?.meta?.cefrLevel ?? (rawBody as any)?.cefrLevel ?? (rawBody as any)?.level ?? DEFAULT_CEFR);` +
        eol
    );
    note("inserted cefrLevel after req.json()");
  } else {
    // As last resort, inject near start of POST block
    post = post.replace(/\{\s*\r?\n/, (m) => m + `  const cefrLevel = DEFAULT_CEFR;` + eol);
    note("inserted cefrLevel fallback at top of POST");
  }
}

// 4) Ensure parseCefrLevel import exists (without duplicating)
if (!/parseCefrLevel/.test(pre + post)) {
  // add near top imports
  const impMatch = (pre + post).match(/^import .*$/m);
  if (impMatch && impMatch.index != null) {
    const all = pre + post;
    const idx = impMatch.index;
    const lineEnd = all.indexOf(eol, idx);
    const insertAt = lineEnd === -1 ? all.length : lineEnd + eol.length;
    const injected = all.slice(0, insertAt) + `import { parseCefrLevel } from "../../../../lib/cefr";` + eol + all.slice(insertAt);
    s = injected;
    note("inserted parseCefrLevel import");
  }
}

s = pre + post;
fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched generate-pack route:", changed.length ? changed.join(", ") : "no changes needed");
