const fs = require("fs");
const path = require("path");

const targets = [
  "app/_features/social/exports/socialThreadExport.ts",
  "app/social/page.tsx",
];

function patchOne(rel) {
  const file = path.join(process.cwd(), rel);
  if (!fs.existsSync(file)) return { file: rel, changed: false, why: "missing" };

  let s = fs.readFileSync(file, "utf8");
  const before = s;
  const notes = [];

  // 1) UI label/value: adapted -> supported (safe)
  s = s.replace(/value="adapted">Adapted<\/option>/g, 'value="supported">Supported</option>');
  if (s !== before) notes.push("option adapted->supported");

  // 2) Runtime alias (so old exports still work): adapted => supported
  // Try to patch the common pattern where variant is read from a select:
  const reVariant = /const\s+variant\s*=\s*([a-zA-Z0-9_.]+\.value)\s*;/g;
  if (reVariant.test(s)) {
    s = s.replace(reVariant, (m, v) =>
      `const variant0 = ${v};\n    const variant = (variant0 === "adapted") ? "supported" : variant0;`
    );
    notes.push("variant alias adapted=>supported");
  }

  // 3) If literal strings "adapted" are used for routing/keys, swap to supported
  // (keeps backward compat because we alias at runtime too)
  if (s.includes('"adapted"') || s.includes("'adapted'")) {
    s = s.replace(/"adapted"/g, '"supported"').replace(/'adapted'/g, "'supported'");
    notes.push("string adapted->supported");
  }

  if (s !== before) {
    fs.writeFileSync(file, s, "utf8");
    return { file: rel, changed: true, notes };
  }
  return { file: rel, changed: false, notes: ["no changes"] };
}

const results = targets.map(patchOne);
for (const r of results) {
  if (r.changed) console.log("✅ Patched:", r.file, "-", r.notes.join(", "));
  else console.log("ℹ️", r.file, "-", (r.why || r.notes.join(", ")));
}
