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

const cefr = read("lib/cefr.ts");
assert.match(cefr, /\["A1",\s*"A2",\s*"B1",\s*"B2",\s*"C1",\s*"C2"\]/, "Canonical CEFR spine must cover A1-C2");
assert.match(cefr, /export const TEXT_TYPES/, "Canonical CEFR module must own text types");
assert.match(cefr, /buildCefrConstraints/, "Canonical CEFR module must own generation constraints");

const legacyCefr = read("lib/cefrCambridge.ts");
assert.match(legacyCefr, /canonical CEFR source of truth is lib\/cefr\.ts/i, "Old CEFR module must be clearly deprecated");
assert.doesNotMatch(legacyCefr, /export const CEFR_LEVELS\s*=/, "Old CEFR module must not define a second level list");
assert.doesNotMatch(legacyCefr, /function getWordTarget/, "Old CEFR module must not define a second target table");

const controls = read("app/_components/CefrTextTypeControls.tsx");
assert.match(controls, /from "@\/lib\/cefr"/, "CEFR controls must import canonical types/constants");
assert.doesNotMatch(controls, /export type CefrLevel\s*=/, "CEFR controls must not define their own CEFR type");

const generationContract = read("lib/contracts/generation.ts");
assert.match(generationContract, /\["standard",\s*"supported"\]/, "Canonical output variants must be standard/supported");

const readingContract = read("lib/contracts/reading.ts");
assert.match(readingContract, /schemaVersion:\s*2/, "Reading contract must be schema version 2");
assert.match(readingContract, /reading:\s*VariantPair<string>/, "Reading contract must use the canonical variant pair");
assert.match(readingContract, /obj\.supported \?\? obj\.SUPPORTED \?\? obj\.adapted/, "Legacy exercise aliases must be normalized at one boundary");
assert.match(readingContract, /readingObj\.supported[\s\S]*readingObj\.SUPPORTED[\s\S]*source\.adaptedText/, "Legacy reading aliases must be normalized at one boundary");

const readingTypes = read("app/_features/reading/readingPackTypes.ts");
assert.match(readingTypes, /@\/lib\/contracts\/reading/, "Reading feature types must re-export the canonical reading contract");

const readingRoute = read("app/api/reading/generate-pack/route.tsx");
assert.match(readingRoute, /schemaVersion: \{ type: "number", enum: \[2\] \}/, "Reading API schema must emit v2");
assert.match(readingRoute, /required: \["standard", "supported"\]/, "Reading API must use lowercase standard/supported");
assert.doesNotMatch(readingRoute, /required: \["standard", "SUPPORTED"\]/, "Reading API must not emit legacy SUPPORTED");
assert.doesNotMatch(readingRoute, /adapted: \{ anyOf:/, "Reading API must not emit legacy adapted exercise sides");
assert.doesNotMatch(readingRoute, /"schoolClass",\s*\n\s*"stage"/, "Reading API schema must not require school class/stage");
assert.match(readingRoute, /normalizeReadingPack/, "Reading API output must pass through the canonical normalizer");

const studio = read("app/_features/reading/ReadingStudio.tsx");
assert.match(studio, /useState<CefrLevel>\("B1"\)/, "Reading Studio CEFR state must be typed canonically");
assert.match(studio, /useState<TextType>\("article"\)/, "Reading Studio text-type state must be typed canonically");
assert.doesNotMatch(studio, /\n\s*stage:\s*payload\.curriculum/, "Reading Studio must not send curriculum stage as a generation level");
assert.doesNotMatch(studio, /\n\s*schoolClass:/, "Reading Studio must not send school class into the ESL generation contract");


const teacherInputs = read("app/_features/reading/TeacherInputsPanel.tsx");
assert.doesNotMatch(teacherInputs, /classLevel\?:|stage\?:|>Class<|>Stage</, "Reading teacher inputs must not expose legacy school class/stage controls");
assert.match(teacherInputs, /Reading target/, "Reading teacher inputs should use ESL reading-target language");

const readingApp = read("app/_features/reading/ReadingPackApp.tsx");
assert.doesNotMatch(readingApp, /kns-crest/, "Reading app must not default to KNS branding");

const activities = read("app/_features/reading/inApp/InAppActivities.tsx");
assert.match(activities, /CEFR_PROFILES/, "In-app reading activities must use CEFR profiles");
assert.doesNotMatch(activities, /STAGE_PROFILES|pack\?\.stage|pack\.stage/, "In-app reading activities must not depend on legacy stage metadata");

for (const rel of [
  "app/_features/reading/exports/interactiveHtml.ts",
  "app/_features/reading/exports/printablesHtml.ts",
  "app/_features/reading/exports/printablesDocx.ts",
  "app/_features/reading/exports/printablesPdf.ts",
]) {
  const src = read(rel);
  assert.doesNotMatch(src, /\.SUPPORTED|\.adapted/, `${rel} must consume canonical supported fields`);
}

console.log(`Aontas ESL phase-2 CEFR/Reading contract verification passed (${activeFiles.length} active TS/TSX files scanned).`);
