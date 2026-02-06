const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "api", "social-thread", "route.ts");
let s = fs.readFileSync(file, "utf8");
const eol = s.includes("\r\n") ? "\r\n" : "\n";
const changed = [];

function addOnce(label, fn) {
  const before = s;
  s = fn(s);
  if (s !== before) changed.push(label);
}

addOnce("import parseCefrLevel", (t) => {
  if (t.includes("parseCefrLevel")) return t;
  return t.replace(
    'import { NextResponse } from "next/server";',
    'import { NextResponse } from "next/server";' + eol +
    'import { parseCefrLevel } from "../../../lib/cefr";'
  );
});

addOnce("read cefrLevel from body", (t) => {
  if (/\bconst\s+cefrLevel\b/.test(t)) return t;
  return t.replace(
    /const\s+tongueInCheek\s*=\s*!!body\?\.(tongueInCheek);/g,
    'const tongueInCheek = !!body?.tongueInCheek;' + eol +
    '  const cefrLevel = parseCefrLevel(body?.cefrLevel ?? body?.level ?? "B1");'
  );
});

addOnce("schema meta.cefrLevel property", (t) => {
  if (t.includes("cefrLevel: { type: \"string\" }")) return t;
  return t.replace(
    /properties:\s*\{\s*model:\s*\{\s*type:\s*"string"\s*\},\s*source:\s*\{\s*type:\s*"string"\s*\},/m,
    'properties: {' + eol +
    '          model: { type: "string" },' + eol +
    '          source: { type: "string" },' + eol +
    '          cefrLevel: { type: "string" },'
  );
});

addOnce("schema require cefrLevel", (t) => {
  return t.replace(
    /required:\s*\[\s*"model"\s*,\s*"source"\s*\]/g,
    'required: ["model", "source", "cefrLevel"]'
  );
});

addOnce("system prompt includes CEFR", (t) => {
  if (t.includes("Requested CEFR level")) return t;
  return t.replace(
    '"You generate a Social Thread Pack for language learning.",',
    '"You generate a Social Thread Pack for language learning.",' + eol +
    '    "Requested CEFR level (A1-C2): " + String(cefrLevel),'
  );
});

addOnce("user prompt includes CEFR", (t) => {
  if (t.includes('"CEFR LEVEL: "')) return t;
  return t.replace(
    /styleNote,\s*\r?\n\s*"\s*",\s*\r?\n\s*"Constraints:"/m,
    'styleNote,' + eol +
    '    "CEFR LEVEL: " + String(cefrLevel),' + eol +
    '    "",' + eol +
    '    "Constraints:"'
  );
});

addOnce("supported rule: dont downgrade", (t) => {
  return t.replace(
    /3\)\s*Keep Supported as access support.*$/m,
    "3) Keep Supported as access support (clearer language / shorter sentences / scaffolds) WITHOUT changing the learning target AND WITHOUT downgrading the CEFR level."
  );
});

addOnce("post-process meta.cefrLevel", (t) => {
  if (t.includes("cefrLevel: String(pack?.meta?.cefrLevel || cefrLevel)")) return t;
  return t.replace(
    "pack = forceFinalStarter(pack, text);",
    "pack = forceFinalStarter(pack, text);" + eol +
    "  pack.meta = {" + eol +
    "    ...(pack.meta || {})," + eol +
    "    model: String(pack?.meta?.model || payload.model)," + eol +
    "    source: String(pack?.meta?.source || \"user_text\")," + eol +
    "    cefrLevel: String(pack?.meta?.cefrLevel || cefrLevel)," + eol +
    "  };"
  );
});

if (!changed.length) {
  console.log("No changes needed (already patched).");
} else {
  fs.writeFileSync(file, s, "utf8");
  console.log("Patched:", changed.join(", "));
}
