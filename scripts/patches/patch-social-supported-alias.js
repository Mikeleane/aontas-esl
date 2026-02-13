/**
 * Patch: Social "adapted" -> "supported" alignment
 * Targets:
 *  - app/social/page.tsx
 *  - app/_features/social/exports/socialThreadExport.ts
 *
 * Keeps backwards compatibility by aliasing adapted -> supported where needed.
 */
const fs = require("fs");

const targets = [
  "app/social/page.tsx",
  "app/_features/social/exports/socialThreadExport.ts",
];

function patchFile(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  const before = s;

  // UI labels/options
  s = s.replace(/\bAdapted\b/g, "Supported");
  s = s.replace(/value="adapted"/g, 'value="supported"');
  s = s.replace(/"adapted"/g, '"supported"');
  s = s.replace(/'adapted'/g, "'supported'");

  // Back-compat alias: if any code still checks adapted, treat it as supported
  // (Light-touch: add a tiny alias where we can safely find variant selection)
  if (!s.includes('variant0 === "adapted"') && /const\s+variant\s*=/.test(s)) {
    s = s.replace(
      /const\s+variant\s*=\s*([a-zA-Z0-9_.]+);\s*/m,
      'const variant0 = $1;\n  const variant = (variant0 === "adapted") ? "supported" : variant0;\n'
    );
  }

  // Ensure supported lookup falls back to adapted if some older packs exist
  if (file.includes("socialThreadExport.ts") && !s.includes("pack?.supported ?? pack?.adapted")) {
    s = s.replace(
      /const\s+sup\s*=\s*pack\?\.\s*supported\s*\?\?\s*\{\s*\}\s*;/,
      "const sup = pack?.supported ?? (pack as any)?.adapted ?? {};"
    );
  }

  if (s !== before) {
    fs.writeFileSync(file, s, "utf8");
    return true;
  }
  return false;
}

const changed = [];
for (const f of targets) if (patchFile(f)) changed.push(f);

console.log(changed.length ? "Patched:\n- " + changed.join("\n- ") : "No changes needed.");
