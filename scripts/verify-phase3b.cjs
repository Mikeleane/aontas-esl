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

const adaptRoute = read("app/api/adapt/route.ts");
assert.match(adaptRoute, /from "@\/lib\/cefr"/, "Adapt must import the canonical CEFR spine directly");
assert.doesNotMatch(adaptRoute, /cefrCambridge|buildCambridgeConstraints/, "Adapt must not depend on deprecated Cambridge naming");
assert.match(adaptRoute, /buildCefrConstraints/, "Adapt must use canonical CEFR constraints");
assert.match(adaptRoute, /getWordTarget/, "Adapt must use canonical CEFR word targets");
assert.match(adaptRoute, /required: \["standard", "supported"\]/, "Adapt structured output must request standard + supported");
assert.doesNotMatch(adaptRoute, /\badapted\b|ADAPTED/, "Adapt route must not generate or consume the legacy adapted variant name");
assert.match(adaptRoute, /https:\/\/api\.openai\.com\/v1\/responses/, "Adapt must use the Responses API boundary");
assert.match(adaptRoute, /text:\s*\{[\s\S]*format:\s*\{[\s\S]*type:\s*"json_schema"/, "Adapt must use structured output JSON schema");
assert.match(adaptRoute, /normalizeAdaptPack/, "Adapt model output must pass through the canonical contract normalizer");
assert.match(adaptRoute, /enforceRateLimit/, "Adapt must use shared rate-limit response handling");
assert.match(adaptRoute, /readJsonObject/, "Adapt must parse request JSON at a typed boundary");
assert.match(adaptRoute, /jsonError/, "Adapt must use shared API error responses");
assert.match(adaptRoute, /ALLOW_DEGRADED_FALLBACK/, "Adapt fallback must remain explicit opt-in");

const adaptContract = read("lib/contracts/adapt.ts");
assert.match(adaptContract, /schemaVersion:\s*2/, "Adapt contract must be schema v2");
assert.match(adaptContract, /standard:\s*string/, "Adapt contract must expose standard");
assert.match(adaptContract, /supported:\s*string/, "Adapt contract must expose supported");
assert.match(adaptContract, /pack\.adapted|root\.adapted/, "Adapt compatibility normalizer must still accept legacy adapted data");

const apiResponse = read("lib/server/apiResponse.ts");
assert.match(apiResponse, /export function jsonError/, "Shared API error helper must exist");
assert.match(apiResponse, /export function enforceRateLimit/, "Shared rate-limit helper must exist");
assert.match(apiResponse, /export async function readJsonObject/, "Shared JSON boundary helper must exist");
assert.match(apiResponse, /code\?: string/, "API errors must support stable machine-readable codes");

const h5pRoute = read("app/api/h5p/create-word-order/route.ts");
assert.match(h5pRoute, /type CefrLevel/, "H5P word-order generation must be CEFR typed");
assert.match(h5pRoute, /SENTENCE_WORD_RANGES:\s*Record<CefrLevel/, "H5P sentence selection must be CEFR based");
assert.match(h5pRoute, /parseCefrLevel\(body\.cefrLevel \?\? body\.level \?\? "B1"\)/, "H5P request must consume CEFR directly");
assert.doesNotMatch(h5pRoute, /\bstage\b|cefrToStageBand|stageBandToCefr/, "H5P active route must not use Stage-era logic");
assert.doesNotMatch(h5pRoute, /:\s*any\b|\bas\s+any\b|\[key:\s*string\]:\s*any/, "H5P route must not use explicit any");
assert.match(h5pRoute, /enforceRateLimit/, "H5P creation must be rate limited consistently");
assert.match(h5pRoute, /MAX_READING_CHARS/, "H5P creation must cap source size");
assert.match(h5pRoute, /jsonError/, "H5P creation must use shared API error responses");
assert.match(h5pRoute, /"\*\$1\*"/, "H5P DragText must preserve every word inside *...*");
assert.match(h5pRoute, /cefrLevel:\s*request\.cefrLevel/, "H5P response must report the canonical CEFR level used");

const cefr = read("lib/cefr.ts");
assert.doesNotMatch(cefr, /cefrToStageBand|stageBandToCefr/, "Canonical CEFR module must not expose Stage conversion helpers");

const stageCompat = read("lib/stageCompat.ts");
assert.match(stageCompat, /Legacy-only compatibility shim/, "Stage conversion must remain explicitly quarantined");
assert.match(stageCompat, /stageFromCefr/, "Legacy stage compatibility may remain in the quarantine shim");

const h5pPage = read("app/h5p/page.tsx");
assert.match(h5pPage, /window\.setTimeout\(\(\) => \{[\s\S]*void loadList\(\)/, "H5P initial load must not synchronously set state from the effect");

const pkg = JSON.parse(read("package.json"));
assert.match(pkg.scripts.test, /verify-phase3b\.cjs/, "Main regression command must include Phase 3B verification");
assert.equal(pkg.scripts["verify:phase3b"], "node scripts/verify-phase3b.cjs", "Phase 3B verifier script must be exposed");

console.log(`Aontas ESL phase-3B API/H5P verification passed (${activeFiles.length} active TS/TSX files scanned).`);
