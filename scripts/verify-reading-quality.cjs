const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../lib/contracts/readingQuality.ts");
const tsSource = fs.readFileSync(filename, "utf8");
const javascript = ts.transpileModule(tsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(javascript, filename);
const { validateReadingPackQuality } = loaded.exports;

const reading = {
  standard: "The class started a new project last year. ".repeat(25),
  supported: "Last year, the class began an exciting new project. ".repeat(25),
};
const validExercise = {
  id: "ex1",
  type: "true_false",
  skill: "reading comprehension",
  standard: { prompt: "The class started a project last year.", options: ["True", "False"] },
  supported: { prompt: "The class started a project last year.", options: ["True", "False"] },
  answer: "True",
  answerIndex: 0,
};
const pack = { reading, exercises: [validExercise] };
const limits = { standardMinWords: 80, supportedMinWords: 80 };

assert.deepEqual(validateReadingPackQuality(pack, limits), [], "Correct True/False item must pass");

const reversedProposition = {
  ...validExercise,
  supported: { prompt: "The class did not start a project last year.", options: ["True", "False"] },
};
let issues = validateReadingPackQuality({ reading, exercises: [reversedProposition] }, limits);
assert(issues.some((issue) => issue.includes("statements differ")), "Reversed Supported meaning must be rejected");

const mismatchedOptions = {
  ...validExercise,
  standard: { prompt: validExercise.standard.prompt, options: ["False", "True"] },
};
issues = validateReadingPackQuality({ reading, exercises: [mismatchedOptions] }, limits);
assert(issues.some((issue) => issue.includes("options must")), "True/False option inversion must be rejected");

const incorrectAnswerIndex = { ...validExercise, answer: "False", answerIndex: 0 };
issues = validateReadingPackQuality({ reading, exercises: [incorrectAnswerIndex] }, limits);
assert(issues.some((issue) => issue.includes("index disagree")), "Wrong shared answer index must be rejected");

const tooShortReading = {
  reading: { standard: "Read and answer the questions.", supported: "Read and answer the questions." },
  exercises: [validExercise],
};
issues = validateReadingPackQuality(tooShortReading, limits);
assert(issues.some((issue) => issue.includes("Standard reading has")), "Missing Standard passage must be rejected");
assert(issues.some((issue) => issue.includes("Supported reading has")), "Missing Supported passage must be rejected");

console.log("Aontas ESL Reading QA verification passed (5 structural scenarios).");
