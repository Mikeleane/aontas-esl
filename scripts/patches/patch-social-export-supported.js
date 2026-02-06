const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "_features", "social", "exports", "socialThreadExport.ts");
let s = fs.readFileSync(file, "utf8");
const eol = s.includes("\r\n") ? "\r\n" : "\n";
const changed = [];

function note(x){ changed.push(x); }

// 1) Change the dropdown option value adapted -> supported (label can stay Adapted if you want, but value must match pack key)
if (s.includes('<option value="adapted">Adapted</option>')) {
  s = s.replace('<option value="adapted">Adapted</option>', '<option value="supported">Supported</option>');
  note("dropdown: adapted->supported (label Supported)");
}

// 2) Also fix any JS that sets default variant to "adapted"
s = s.replace(/(["'])adapted(["'])/g, (m,q1,q2) => {
  // Keep occurrences that are in fallback arrays containing both supported+adapted; we’ll handle that separately below.
  return m;
});

// 3) Make variant resolver robust: if UI asks for "supported" use supported; if "adapted" map to supported.
// This is safe even if your file already has logic; we’ll only insert if we can find the handler.
if (!s.includes("function normalizeVariantKey")) {
  const helper =
`function normalizeVariantKey(v: string) {
  const k = String(v || "").toLowerCase();
  if (k === "adapted") return "supported";
  return k;
}
`;

  // Insert near top: after first type/interface block or after imports
  const impEnd = s.indexOf(eol + eol);
  if (impEnd !== -1) {
    s = s.slice(0, impEnd + 2) + helper + eol + s.slice(impEnd + 2);
    note("added normalizeVariantKey helper");
  }
}

// 4) Ensure variant selection uses normalizeVariantKey when reading from select value
// Try a simple targeted replace: "variantSel.value" uses normalizeVariantKey(...)
if (!s.includes("normalizeVariantKey(variantSel.value)")) {
  s = s.replace(
    /const\s+variant\s*=\s*variantSel\.value\s*;/,
    "const variant = normalizeVariantKey(variantSel.value);"
  );
  if (s.includes("const variant = normalizeVariantKey(variantSel.value);")) note("variantSel normalized");
}

// 5) Ensure pack variant lookup prioritizes supported, but still tolerates adapted
// Replace a common pattern if present
s = s.replace(
  /const\s+sup\s*=\s*pack\?\.\s*supported\s*\?\?\s*pack\?\.\s*adapted\s*\?\?\s*\{\s*\}\s*;/,
  "const sup = pack?.supported ?? pack?.adapted ?? {};"
);

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched socialThreadExport.ts:", changed.length ? changed.join(", ") : "no changes needed");
