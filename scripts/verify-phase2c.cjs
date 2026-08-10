const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

let ts = null;
try { ts = require("typescript"); } catch {}

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
    const sf = ts.createSourceFile(
      rel,
      read(rel),
      ts.ScriptTarget.Latest,
      true,
      rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    for (const diagnostic of sf.parseDiagnostics) {
      parseErrors.push(`${rel}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
    }
  }
  assert.equal(parseErrors.length, 0, `TypeScript parse errors:\n${parseErrors.join("\n")}`);
}

const contract = read("lib/contracts/social.ts");
assert.match(contract, /schemaVersion:\s*2/, "Social contract must use schema version 2");
assert.match(contract, /textType:\s*"short_message"/, "Social contract must use the canonical short-message text type");
assert.match(contract, /standard:\s*SocialThreadVariant/, "Social contract must define Standard thread");
assert.match(contract, /supported:\s*SocialThreadVariant/, "Social contract must define Supported thread");
assert.match(contract, /checks:\s*SocialCheck\[\]/, "Social checks must be shared at pack level");
assert.match(contract, /source\.supported \?\? source\.SUPPORTED \?\? source\.adapted/, "Legacy Social aliases must be confined to the normalizer");
assert.match(contract, /validateSocialPack/, "Social contract must expose consistency validation");
assert.match(contract, /not aligned/, "Social validation must detect message alignment drift");
assert.match(contract, /no shared answer/, "Social validation must require shared check answers");

const route = read("app/api/social-thread/route.ts");
assert.match(route, /from "@\/lib\/cefr"/, "Social API must import the canonical CEFR spine directly");
assert.doesNotMatch(route, /cefrCambridge/, "Social API must not import the deprecated CEFR module");
assert.match(route, /from "@\/lib\/contracts\/social"/, "Social API must use the canonical Social contract");
assert.match(route, /cefrStyleGuide\(cefrLevel\)/, "Social generation must materially use the selected CEFR level");
assert.match(route, /getWordTarget\(cefrLevel, "short_message"\)/, "Social generation must use canonical CEFR length guidance");
assert.match(route, /Use IDs m-1 through m-10 in both variants/, "Social prompt must require stable cross-variant message IDs");
assert.match(route, /Checks are shared by both variants/, "Social prompt must require shared checks/answers");
assert.match(route, /normalizeSocialPack/, "Social model output must pass through the canonical normalizer");
assert.match(route, /alignSocialVariants/, "Social model output must align variant IDs/order");
assert.match(route, /validateSocialPack\(pack/, "Social model output must pass the consistency validator");
assert.doesNotMatch(route, /rawPreview|contentPreview/, "Social API must not echo raw upstream/model output to clients");

const page = read("app/social/page.tsx");
assert.match(page, /CEFR_LEVELS/, "Social UI must use the canonical A1-C2 level list");
assert.match(page, /useState<CefrLevel>/, "Social UI CEFR state must use the canonical type");
assert.match(page, /SocialPackData/, "Social UI must use the canonical Social pack type");
assert.match(page, /normalizeSocialPack/, "Social UI must normalize API responses at the boundary");
assert.doesNotMatch(page, /\bany\b/, "Social UI must not rely on any");
assert.doesNotMatch(page, /\.SUPPORTED|\.adapted/, "Social UI must not consume legacy variant aliases");

const exporter = read("app/_features/social/exports/socialThreadExport.ts");
assert.match(exporter, /SocialPackData/, "Social exporter must use the canonical Social pack type");
assert.match(exporter, /normalizeSocialPack\(opts\.pack\)/, "Social exporter must normalize legacy packs once at its boundary");
assert.doesNotMatch(exporter, /function pickVariantPack|function getMessages|function getConcepts/, "Social exporter must not maintain parallel legacy-shape helpers");
assert.match(exporter, /Array\.isArray\(pack\.concepts\)/, "Exported HTML must render canonical concepts without missing helper functions");
assert.match(exporter, /function escapeHtml\(value\)\{/, "Exported HTML must include its own browser-side escapeHtml helper");

const pkg = JSON.parse(read("package.json"));
assert.match(pkg.scripts.test, /verify-phase2c\.cjs/, "Main test command must include Phase 2C verification");
assert.equal(pkg.scripts["verify:phase2c"], "node scripts/verify-phase2c.cjs", "Phase 2C verifier script must be exposed");

console.log(`Aontas ESL phase-2C Social contract verification passed (${activeFiles.length} active TS/TSX files scanned).`);
