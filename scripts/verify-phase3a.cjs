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

function assertNoExplicitAny(rel) {
  const source = read(rel);
  assert.doesNotMatch(
    source,
    /:\s*any\b|\bas\s+any\b|Array<any>|<any>/,
    `${rel} must not use explicit any in the canonical Phase-3A path`
  );
}

[
  "app/api/reading/generate-pack/route.tsx",
  "app/exercises/page.tsx",
  "app/social/page.tsx",
  "app/wordiness/page.tsx",
  "lib/contracts/generation.ts",
  "lib/contracts/reading.ts",
  "lib/contracts/exercises.ts",
  "lib/contracts/social.ts",
  "lib/contracts/wordiness.ts",
  "lib/exporters.ts",
].forEach(assertNoExplicitAny);

const teacherInputs = read("app/_features/reading/TeacherInputsPanel.tsx");
assert.doesNotMatch(teacherInputs, /setActiveId\(materials\[0\]\.id\)/, "Teacher material selection must not synchronously set state from an effect");
assert.doesNotMatch(teacherInputs, /const updateActive\s*=/, "Unused updateActive helper must stay removed");
assert.doesNotMatch(teacherInputs, /const c:\s*any/, "Teacher input uid helper must use typed global crypto");
assert.match(teacherInputs, /Local object URLs are browser-only previews/, "Local image preview must document why raw img is intentional");

const activities = read("app/_features/reading/inApp/InAppActivities.tsx");
assert.doesNotMatch(activities.split("\n")[2] || "", /useRef/, "Unused useRef import must stay removed");
assert.match(activities, /function MorphologyAttempt/, "Morphology reset must use a keyed attempt component");
assert.match(activities, /key={`\$\{g\.id\}:\$\{props\.supported/, "Morphology attempt must remount when the game/route changes");

const h5pPage = read("app/h5p/page.tsx");
assert.match(h5pPage, /useCallback/, "H5P list loader must be stable for its effect dependency");
assert.doesNotMatch(h5pPage, /eslint-disable-next-line react-hooks\/exhaustive-deps/, "Stale H5P hook suppression must stay removed");

const wordiness = read("app/wordiness/page.tsx");
assert.match(wordiness, /from "next\/image"/, "Wordiness static brand mark must use Next Image");
assert.doesNotMatch(wordiness, /<img className={styles\.mark}/, "Wordiness brand mark must not regress to raw img");

const readingRoute = read("app/api/reading/generate-pack/route.tsx");
assert.match(readingRoute, /function normalizeTeacherRequest\(body: unknown\)/, "Reading request normalizer must accept unknown at the boundary");
assert.match(readingRoute, /function extractResponsesText\(resp: unknown\)/, "Reading Responses parser must accept unknown");
assert.doesNotMatch(readingRoute, /body\.stage/, "Reading generation core must not consume Stage directly");
assert.match(readingRoute, /request\.stage/, "Legacy Stage support may exist only inside the request compatibility normalizer");
assert.match(readingRoute, /const packRecord = asRecord\(pack\)/, "Parsed model JSON must be narrowed before property access");

const exporters = read("lib/exporters.ts");
assert.match(exporters, /coreBuildPrintablesHtml/, "Reading export facade must call the real printable HTML builder");
assert.match(exporters, /coreBuildTeacherKeyHtml/, "Reading export facade must call the real teacher-key builder");
assert.doesNotMatch(exporters, /fallbackHtml|inferPackFromArgs|splitPackArg/, "Legacy fallback export maze must stay removed");

const socialExport = read("app/_features/social/exports/socialThreadExport.ts");
assert.match(socialExport, /<option value="supported">Supported<\/option>/, "Offline Social export must expose Supported route");
assert.doesNotMatch(socialExport, /<option value="adapted">/, "Offline Social export must not expose legacy Adapted route");

const exerciseRoute = read("app/api/exercises/route.ts");
assert.doesNotMatch(exerciseRoute, /const w2 = sharedWords/, "Unused exercise fallback word must stay removed");

const interactive = read("app/_features/reading/exports/interactiveHtml.ts");
assert.doesNotMatch(interactive.split("\n")[0] || "", /ReadingMode/, "Interactive export must not import unused ReadingMode");

// Legacy shape aliases remain intentionally readable only at compatibility boundaries.
for (const rel of [
  "lib/contracts/reading.ts",
  "lib/contracts/exercises.ts",
  "lib/contracts/social.ts",
  "lib/contracts/wordiness.ts",
]) {
  const source = read(rel);
  assert.match(source, /adapted|SUPPORTED/, `${rel} must retain explicit legacy normalization support`);
}

// Old KNS PDF implementations are retained for later repo deletion, but no active app path may import them.
for (const rel of activeFiles) {
  const normalized = rel.replace(/\\/g, "/");
  if (normalized.startsWith("lib/export/reading/") || normalized === "lib/branding/knsBrand.ts") continue;
  const source = read(rel);
  assert.doesNotMatch(source, /branding\/knsBrand|KNS_CREST_DATA_URL|export\/reading\/pdf\.(student|teacher)/, `${rel} must not depend on quarantined KNS PDF code`);
}

const pkg = JSON.parse(read("package.json"));
assert.equal(pkg.scripts["lint:strict"], "eslint app lib --max-warnings=0", "Phase 3A must expose zero-warning lint gate");
assert.equal(pkg.scripts.check, "npm run typecheck && npm run lint:strict", "check must enforce typecheck + zero-warning lint");
assert.match(pkg.scripts.test, /verify-phase3a\.cjs/, "Main regression command must include Phase 3A verification");
assert.equal(pkg.scripts["verify:phase3a"], "node scripts/verify-phase3a.cjs", "Phase 3A verifier script must be exposed");

console.log(`Aontas ESL phase-3A hardening verification passed (${activeFiles.length} active TS/TSX files scanned).`);
