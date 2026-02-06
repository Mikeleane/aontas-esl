// scripts/patches/patch-esl-social-sanity.js
// Run with: node scripts/patches/patch-esl-social-sanity.js

const fs = require("fs");

const changed = [];
const missing = [];

function read(p) {
  return fs.readFileSync(p, "utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
  changed.push(p);
}

function patchFile(p, fn) {
  if (!fs.existsSync(p)) { missing.push(p); return; }
  const before = read(p);
  const after = fn(before);
  if (after !== before) write(p, after);
}

function replaceAll(s, find, rep) {
  return s.split(find).join(rep);
}

function patchSocialPage(s) {
  // UI: Adapted -> Supported
  s = s.replace(/<option value="adapted">Adapted<\/option>/g, '<option value="supported">Supported</option>');
  s = s.replace(/value="adapted"/g, 'value="supported"');
  s = s.replace(/\bAdapted\b/g, "Supported");
  // Any literal "adapted" variant strings in this UI should become "supported"
  s = s.replace(/(["'])adapted\1/g, '"supported"');
  return s;
}

function patchSocialExport(s) {
  // Export UI: Adapted -> Supported (keep backwards compat in data, but UI should say Supported)
  s = s.replace(/<option value="adapted">Adapted<\/option>/g, '<option value="supported">Supported</option>');
  s = s.replace(/value="adapted"/g, 'value="supported"');
  s = s.replace(/\bAdapted\b/g, "Supported");
  // If export logic ever indexes pack.adapted?.something, prefer supported then fallback to adapted
  s = s.replace(/pack\?\.\s*adapted\?\./g, "(pack?.supported ?? pack?.adapted)?.");
  s = s.replace(/\bpack\.\s*adapted\./g, "(pack.supported ?? pack.adapted).");
  return s;
}

function patchSocialApiEmoji(s) {
  // Add cleanEmoji helper if missing, and use it where emoji is assigned in applyRoster()->fixMessages()
  if (!s.includes("function cleanEmoji(")) {
    s = s.replace(
      /function uniqStrings\([^\)]*\)\s*\{[\s\S]*?\}\s*\r?\n/,
      (m) => m + `
function cleanEmoji(e) {
  const t = String(e ?? "").trim();
  if (!t) return null;
  // Kill classic mojibake markers (Ã â ð) and long garbage sequences
  if (/[Ãâð]/.test(t) || t.length > 10) return null;
  return t;
}

`
    );
  }

  // Replace the emoji assignment block (very specific match, low risk)
  s = s.replace(
    /const emoji = \(\s*m\?\.\s*emoji[\s\S]*?\)\s*\?\s*String\(m\.emoji\)[\s\S]*?:\s*\(mapped \? mapped\.emoji : null\);/,
`const emojiFromModel = cleanEmoji(m?.emoji);
      const emoji = (emojiFromModel != null && String(emojiFromModel).trim() !== "")
        ? String(emojiFromModel)
        : (mapped ? mapped.emoji : null);`
  );

  // Light roster mojibake cleanup (safe, only if those exact sequences exist)
  s = replaceAll(s, "Oâ€™", "O’");
  s = replaceAll(s, "NÃ­", "Ní");
  s = replaceAll(s, "Ãº", "ú");
  s = replaceAll(s, "Ã¡", "á");
  s = replaceAll(s, "Ã³", "ó");
  s = replaceAll(s, "Ã­n", "ín");
  s = replaceAll(s, "â€™", "’");

  return s;
}

patchFile("app/social/page.tsx", patchSocialPage);
patchFile("app/_features/social/exports/socialThreadExport.ts", patchSocialExport);
patchFile("app/api/social-thread/route.ts", patchSocialApiEmoji);

console.log("=== ESL Social Sanity Patch ===");
if (changed.length) console.log("Patched:\n- " + changed.join("\n- "));
else console.log("No changes needed.");
if (missing.length) console.log("Missing (skipped):\n- " + missing.join("\n- "));
