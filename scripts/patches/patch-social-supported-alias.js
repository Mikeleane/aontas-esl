/**
 * Patch: social export + /social page
 * Fix: adapted vs supported mismatch -> empty thread
 */
const fs = require("fs");
const path = require("path");

const targets = [
  path.join(process.cwd(), "app", "_features", "social", "exports", "socialThreadExport.ts"),
  path.join(process.cwd(), "app", "social", "page.tsx"),
];

function patchFile(file) {
  if (!fs.existsSync(file)) return { file, changed: false, reason: "missing" };
  let s = fs.readFileSync(file, "utf8");
  const before = s;

  // 1) Option label/value
  s = s.replace(/<option value="adapted">Adapted<\/option>/g, '<option value="supported">Supported</option>');
  s = s.replace(/value="adapted"\s*>Adapted</g, 'value="supported">Supported');

  // 2) Variant mapping: adapted -> supported
  // Common pattern in export html builder code:
  s = s.replace(
    /const\s+variant\s*=\s*([a-zA-Z0-9_.]+\.value)\s*;/g,
    'const variant0 = $1;\n    const variant = (variant0 === "adapted") ? "supported" : variant0;'
  );

  // 3) If code grabs pack.adapted directly, make it prefer supported
  s = s.replace(/\bpack\?\.\s*adapted\b/g, "pack?.supported ?? pack?.adapted");

  // 4) mojibake quick clean
  s = s
    .replace(/â€™/g, "’")
    .replace(/â€“/g, "–");

  if (s !== before) {
    fs.writeFileSync(file, s, "utf8");
    return { file, changed: true };
  }
  return { file, changed: false };
}

const results = targets.map(patchFile);
const changed = results.filter(r => r.changed).map(r => r.file);

if (changed.length) {
  console.log("✅ Patched:\n- " + changed.join("\n- "));
} else {
  console.log("ℹ️ No changes needed.");
}
