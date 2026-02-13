const fs = require("fs");
const path = require("path");

const files = [
  path.join(process.cwd(), "app", "_features", "social", "exports", "socialThreadExport.ts"),
];

let changed = 0;

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const before = fs.readFileSync(f, "utf8");
  let s = before;

  // UI option: adapted -> supported
  s = s.replace(/<option value="adapted">Adapted<\/option>/g, '<option value="supported">Supported</option>');

  // Back-compat read: prefer supported, fallback to adapted
  s = s.replace(/pack\?\.(adapted)\b/g, "pack?.supported ?? pack?.adapted");

  // If code reads variant value, alias adapted -> supported
  s = s.replace(
    /const\s+variant\s*=\s*([a-zA-Z0-9_.]+)\.value\s*;/g,
    'const variant0 = $1.value;\n    const variant = (variant0 === "adapted") ? "supported" : variant0;'
  );

  if (s !== before) {
    fs.writeFileSync(f, s, "utf8");
    console.log("✅ Patched:", f);
    changed++;
  }
}

if (!changed) console.log("ℹ️ No changes needed.");
