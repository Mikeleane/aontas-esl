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

const contract = read("lib/contracts/exercises.ts");
assert.match(contract, /schemaVersion:\s*2/, "Exercises contract must use schema version 2");
assert.match(contract, /standard:\s*ExerciseSide/, "Exercises contract must define Standard side");
assert.match(contract, /supported:\s*ExerciseSide/, "Exercises contract must define Supported side");
assert.match(contract, /obj\.supported \?\? obj\.SUPPORTED \?\? obj\.adapted/, "Legacy aliases must be confined to the exercise normalizer");
assert.match(contract, /validateExercisesPack/, "Exercises contract must expose consistency validation");
assert.match(contract, /repeats id/, "Exercises validation must reject duplicate IDs");
assert.match(contract, /no shared answer/, "Exercises validation must require a shared answer");

const readingContract = read("lib/contracts/reading.ts");
assert.match(readingContract, /from "@\/lib\/contracts\/exercises"/, "Reading must reuse the canonical exercise contract");
assert.match(readingContract, /normalizeExerciseItem/, "Reading must reuse the exercise compatibility boundary");

const route = read("app/api/exercises/route.ts");
assert.match(route, /from "@\/lib\/cefr"/, "Exercises API must import the canonical CEFR spine directly");
assert.doesNotMatch(route, /cefrCambridge/, "Exercises API must not import the deprecated CEFR module");
assert.match(route, /buildCefrConstraints/, "Exercises API must use canonical CEFR constraints");
assert.match(route, /schemaVersion:\s*2/, "Exercises fallback must emit schema v2");
assert.match(route, /supported:\s*\{/, "Exercises fallback must emit lowercase supported sides");
assert.doesNotMatch(route, /\badapted:\s*\{/, "Exercises API must not emit legacy adapted sides");
assert.match(route, /"supported": \{ "prompt":/, "AI return contract must request lowercase supported");
assert.match(route, /normalizeExercisesPack\(parsed/, "AI output must pass through the canonical normalizer");
assert.match(route, /validateExercisesPack\(pack\)/, "AI output must pass the consistency validator");
assert.match(route, /standardSeed = standardText \|\| providedText/, "Offline fallback must use supplied source text");
assert.match(route, /body\.adaptedText[\s\S]*body\.adaptedOutput[\s\S]*body\.adapted/, "Legacy request aliases may be accepted only at the request boundary");

const page = read("app/exercises/page.tsx");
assert.match(page, /CefrTextTypeControls/, "Exercises UI must reuse the shared CEFR/text-type controls");
assert.match(page, /useState<CefrLevel>/, "Exercises UI CEFR state must be typed canonically");
assert.match(page, /useState<TextType>/, "Exercises UI text-type state must be typed canonically");
assert.match(page, /normalizeExercisesPack/, "Exercises UI must consume the canonical response normalizer");
assert.match(page, /item\.supported\.prompt/, "Exercises UI must render the canonical Supported side");
assert.doesNotMatch(page, /\.SUPPORTED|\.adapted/, "Exercises UI must not consume legacy variant aliases");
assert.match(page, /Copy canonical JSON/, "Exercises UI copy action must export the full canonical pack");

const pkg = JSON.parse(read("package.json"));
assert.match(pkg.scripts.test, /verify-phase2b\.cjs/, "Main test command must include Phase 2B verification");
assert.equal(pkg.scripts["verify:phase2b"], "node scripts/verify-phase2b.cjs", "Phase 2B verifier script must be exposed");

console.log(`Aontas ESL phase-2B Exercises contract verification passed (${activeFiles.length} active TS/TSX files scanned).`);
