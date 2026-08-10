const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const must = (condition, message) => { if (!condition) throw new Error(message); };

const contract = read("lib/contracts/wordiness.ts");
must(contract.includes("schemaVersion: 2"), "Wordiness contract must be schema v2");
must(contract.includes("variants: VariantPair<WordinessVariantSeed>"), "Wordiness must keep standard/supported variants");
must(contract.includes("text: string") && contract.includes("seedText: string"), "Wordiness variant must guarantee text + seedText aliases");
must(contract.includes("normalizeWordinessSeed"), "Legacy Wordiness seeds must normalize at one boundary");
must(contract.includes("selectWordinessSeedVariant"), "Wordiness must expose an active legacy-compatible game seed");

const builder = read("app/_features/wordiness/buildWordinessSeed.ts");
must(builder.includes("buildWordinessSeedFromVariants"), "Wordiness builder must support route pairs");

const reading = read("app/_features/reading/ReadingPackApp.tsx");
must(reading.includes("buildWordinessSeedFromVariants"), "Reading Pack must seed Wordiness with both routes");
must(reading.includes("standard: readingStandard") && reading.includes("supported: readingSupported"), "Reading Pack must preserve standard/supported text in Wordiness seed");

const hub = read("app/wordiness/page.tsx");
must(hub.includes("/api/wordiness"), "Wordiness hub must use the live filesystem API");
must(hub.includes("normalizeWordinessSeed"), "Wordiness hub must open legacy and v2 seeds");
must(hub.includes("Copy Standard → Supported"), "Wordiness hub must expose route-aware seed editing");
must(!hub.includes("Kilgobnet"), "Wordiness hub must not use KNS school branding");

const api = read("app/api/wordiness/route.ts");
must(api.includes("readdir(dir"), "Wordiness API must scan live game files");
must(api.includes("inferTags"), "Wordiness API must enrich games missing stale-manifest metadata");

const bridge = read("public/wordiness/wordiness-seed-bridge.js");
must(bridge.includes("getPack") && bridge.includes("getSeed"), "Wordiness bridge must expose pack and active seed views");
must(bridge.includes("text: selected.text") && bridge.includes("seedText: selected.text"), "Legacy game seed must guarantee text + seedText");
must(bridge.includes("standard: pack.variants.standard") && bridge.includes("supported: pack.variants.supported"), "Game seed must retain both route variants");

const mark = read("public/wordiness/aontas-esl-mark.svg");
must(mark.includes("Aontas ESL"), "Aontas ESL Wordiness mark missing");

const gameDir = path.join(root, "public", "wordiness");
if (fs.existsSync(gameDir)) {
  const gameFiles = fs.readdirSync(gameDir).filter((name) => /\.(html|htm)$/i.test(name) && !name.startsWith("_"));
  must(gameFiles.length >= 22, `Expected at least the legacy Wordiness suite; found ${gameFiles.length} game files`);
}

console.log("Aontas ESL phase-2D Wordiness contract verification passed.");
