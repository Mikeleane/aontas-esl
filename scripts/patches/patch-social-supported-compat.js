const fs = require("fs");
const path = require("path");

const targets = [
  path.join(process.cwd(), "app/_features/social/exports/socialThreadExport.ts"),
  path.join(process.cwd(), "app/social/page.tsx"),
];

function backup(p) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = `${p}.bak_${stamp}`;
  fs.copyFileSync(p, bak);
  return bak;
}

const changes = [];

for (const p of targets) {
  if (!fs.existsSync(p)) continue;
  const bak = backup(p);
  let s = fs.readFileSync(p, "utf8");
  const before = s;

  // UI label: Adapted -> Supported (keep content compatible)
  s = s.replace(/<option value="adapted">\s*Adapted\s*<\/option>/g, '<option value="supported">Supported</option>');

  // Default state: "adapted" -> "supported" (React pages)
  s = s.replace(/useState\(\s*["']adapted["']\s*\)/g, 'useState("supported")');
  s = s.replace(/useState<[^>]+>\(\s*["']adapted["']\s*\)/g, (m) => m.replace(/["']adapted["']/, '"supported"'));

  // Hard compat: if pack has supported but not adapted, create alias (fixes "empty" when something still asks for adapted)
  // Insert near a common anchor in exporter code.
  if (p.endsWith("socialThreadExport.ts") && !s.includes("packAny.adapted = packAny.supported")) {
    const anchor = /const\s+std\s*=\s*pack\?\.(standard|student)\s*\?\?\s*\{\s*\};/;
    if (anchor.test(s)) {
      s = s.replace(anchor, (m) => {
        return (
`  const packAny: any = pack as any;
  if (packAny?.supported && !packAny?.adapted) packAny.adapted = packAny.supported;
  if (packAny?.adapted && !packAny?.supported) packAny.supported = packAny.adapted;

` + m
        );
      });
    }
  }

  if (s !== before) {
    fs.writeFileSync(p, s, "utf8");
    changes.push({ file: p, backup: bak });
  }
}

if (!changes.length) {
  console.log("ℹ️ No social files changed.");
} else {
  console.log("✅ Patched social supported/adapted compat:");
  for (const c of changes) console.log(" -", c.file, " (backup:", c.backup + ")");
}
