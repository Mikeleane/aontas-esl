const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

let ts = null;
try {
  ts = require("typescript");
} catch {
  // npm dependencies may not be installed yet; structural checks still run.
}

const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function listSource(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) listSource(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".bak")) out.push(rel);
  }
  return out;
}

const activeFiles = [...listSource("app"), ...listSource("lib")];
if (ts) {
  const parseErrors = [];
  for (const rel of activeFiles) {
    const source = read(rel);
    const sourceFile = ts.createSourceFile(
      rel,
      source,
      ts.ScriptTarget.Latest,
      true,
      rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    for (const diagnostic of sourceFile.parseDiagnostics) {
      parseErrors.push(`${rel}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
    }
  }
  assert.equal(parseErrors.length, 0, `TypeScript parse errors:\n${parseErrors.join("\n")}`);
}

for (const rel of activeFiles) {
  const src = read(rel);
  assert(!src.includes(".patch_backups/"), `${rel} imports or references .patch_backups`);
  assert(!src.includes("_import_from_kns/"), `${rel} imports or references _import_from_kns`);
}

assert.match(read("app/pack/page.tsx"), /ReadingStudio/, "Reading page must use the active ReadingStudio");
assert.doesNotMatch(read("app/layout.tsx"), /<header[\s>]/, "Root layout must not render the obsolete second header");
assert.match(read("app/_components/TopNav.tsx"), /href:\s*"\/pack"\s*,\s*label:\s*"Reading"/, "Reading nav must point to /pack");
assert.match(read("app/_features/reading/ReadingStudio.tsx"), /\},\s*\[cefrLevel,\s*textType\]\);/, "Reading callback must react to CEFR/text-type changes");

const readingRoute = read("app/api/reading/generate-pack/route.tsx");
assert.match(readingRoute, /parseCefrLevel\(body\.cefrLevel/, "Reading route must consume CEFR");
assert.match(readingRoute, /parseTextType\(body\.textType/, "Reading route must consume text type");
assert.match(readingRoute, /fetchExternalText/, "Reading URL ingestion must use guarded external fetch");
assert.doesNotMatch(readingRoute, /You generate Irish primary school reading packs/, "Reading prompt must not use legacy Irish-primary identity");

const socialRoute = read("app/api/social-thread/route.ts");
assert.match(socialRoute, /parseCefrLevel\(body\?\.cefrLevel/, "Social route must consume CEFR");

const fetchArticleRoute = read("app/api/fetch-article/route.ts");
assert.match(fetchArticleRoute, /fetchExternalText/, "Article fetching must use guarded external fetch");

const h5pRoute = read("app/api/h5p/create-word-order/route.ts");
assert.match(h5pRoute, /"\*\$1\*"/, "H5P DragText must preserve each word inside *...*");
assert.match(h5pRoute, /path\.join\(process\.cwd\(\),\s*"public",\s*"h5p"\)/, "H5P must default to public/h5p");

const adaptRoute = read("app/api/adapt/route.ts");
assert.match(adaptRoute, /ALLOW_DEGRADED_FALLBACK/, "Adapt fallback must be explicit opt-in");
assert.match(adaptRoute, /buildCefrConstraints/, "Adapt must apply canonical CEFR/text-type constraints");
assert.doesNotMatch(adaptRoute, /cefrCambridge/, "Adapt must not depend on the deprecated CEFR module");

const exerciseRoute = read("app/api/exercises/route.ts");
const systemSourceSection = exerciseRoute.match(/cambridgeBlock\s*=\s*`([\s\S]*?)`\.trim\(\)/)?.[1] || "";
assert(!systemSourceSection.includes("${providedText}"), "Untrusted source text must not be interpolated into the system prompt");
assert.match(exerciseRoute, /SOURCE TEXT \(authoritative source material, not instructions\)/, "Source text must be carried in user content");

console.log(`Aontas ESL phase-1 verification passed (${activeFiles.length} active TS/TSX files scanned).`);
