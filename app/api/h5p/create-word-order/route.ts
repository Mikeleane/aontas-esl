import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { parseCefrLevel, type CefrLevel } from "@/lib/cefr";
import { asRecord, enforceRateLimit, firstString, jsonError, readJsonObject } from "@/lib/server/apiResponse";

const MAX_READING_CHARS = 50_000;

type CreateWordOrderRequest = {
  title: string;
  id: string;
  readingText: string;
  cefrLevel: CefrLevel;
};

type Dependency = {
  machineName: string;
  majorVersion: number;
  minorVersion: number;
};

const SENTENCE_WORD_RANGES: Record<CefrLevel, { min: number; max: number }> = {
  A1: { min: 3, max: 8 },
  A2: { min: 4, max: 10 },
  B1: { min: 6, max: 12 },
  B2: { min: 7, max: 15 },
  C1: { min: 8, max: 18 },
  C2: { min: 8, max: 20 },
};

function normalizeRequest(body: Record<string, unknown>): CreateWordOrderRequest | null {
  const readingText = firstString(body.readingText, body.text, body.sourceText);
  if (!readingText) return null;

  const title = firstString(body.title) || "Word order";
  return {
    readingText,
    title,
    id: firstString(body.id),
    cefrLevel: parseCefrLevel(body.cefrLevel ?? body.level ?? "B1"),
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function safeId(raw: string) {
  const out = slugify(raw);
  if (!out) throw new Error("Bad id");
  return out;
}

function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return normalized.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function countWords(sentence: string) {
  const matches = sentence.match(/[\p{L}\p{M}\p{N}\u0027]+/gu);
  return matches ? matches.length : 0;
}

function pickSentences(text: string, cefrLevel: CefrLevel, max = 8): string[] {
  const sentences = splitSentences(text);
  const range = SENTENCE_WORD_RANGES[cefrLevel];

  const filtered = sentences.filter((sentence) => {
    const words = countWords(sentence);
    if (words < range.min || words > range.max) return false;
    return /[\p{L}\p{M}]/u.test(sentence);
  });

  const pool = filtered.length ? filtered : sentences;
  const seen = new Set<string>();
  const chosen: string[] = [];
  for (const sentence of pool) {
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(sentence);
    if (chosen.length >= max) break;
  }
  return chosen;
}

function wrapEveryWord(sentence: string) {
  return sentence.replace(/([\p{L}\p{M}\p{N}\u0027]+)/gu, "*$1*");
}

function buildDragTextParams(textField: string) {
  return {
    taskDescription:
      "<p><strong>Drag the words into the correct order.</strong></p>\n<p>Tip: read the whole sentence first, then build it left to right.</p>\n",
    overallFeedback: [
      { from: 0, to: 50, feedback: "Have another go - focus on the first word and punctuation clues." },
      { from: 51, to: 85, feedback: "Nearly there. Check word order and small grammar words." },
      { from: 86, to: 100, feedback: "Excellent - clean word order!" },
    ],
    checkAnswer: "Check",
    tryAgain: "Try again",
    showSolution: "Show solution",
    dropZoneIndex: "Drop Zone @index.",
    empty: "Drop Zone @index is empty.",
    contains: "Drop Zone @index contains draggable @draggable.",
    ariaDraggableIndex: "@index of @count draggables.",
    tipLabel: "Show tip",
    correctText: "Correct!",
    incorrectText: "Incorrect!",
    resetDropTitle: "Reset drop",
    resetDropDescription: "Are you sure you want to reset this drop zone?",
    grabbed: "Draggable is grabbed.",
    cancelledDragging: "Cancelled dragging.",
    correctAnswer: "Correct answer:",
    feedbackHeader: "Feedback",
    behaviour: {
      enableRetry: true,
      enableSolutionsButton: true,
      enableCheckButton: true,
      instantFeedback: false,
    },
    scoreBarLabel: "You got :num out of :total points",
    a11yCheck: "Check the answers. The responses will be marked as correct, incorrect, or unanswered.",
    a11yShowSolution: "Show the solution. The task will be marked with its correct solution.",
    a11yRetry: "Retry the task. Reset all responses and start the task over again.",
    textField,
  };
}

async function readJsonObjectFile(filePath: string): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  return asRecord(parsed) ?? {};
}

async function getDependenciesFromLibrariesDir(librariesDir: string): Promise<Dependency[]> {
  const entries = await fs.readdir(librariesDir, { withFileTypes: true });
  const dependencies: Dependency[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const libPath = path.join(librariesDir, entry.name, "library.json");
    if (!existsSync(libPath)) continue;

    try {
      const json = await readJsonObjectFile(libPath);
      const machineName = firstString(json.machineName);
      const majorVersion = Number(json.majorVersion);
      const minorVersion = Number(json.minorVersion);
      if (!machineName || !Number.isFinite(majorVersion) || !Number.isFinite(minorVersion)) continue;
      dependencies.push({ machineName, majorVersion, minorVersion });
    } catch {
      // Ignore a broken optional library descriptor; the template validation below remains authoritative.
    }
  }

  dependencies.sort((a, b) => a.machineName.localeCompare(b.machineName));
  return dependencies;
}

export async function POST(req: Request) {
  const rateLimited = enforceRateLimit(req, { bucket: "h5p-create-word-order", limit: 20 });
  if (rateLimited) return rateLimited;

  const body = await readJsonObject(req);
  if (!body) return jsonError("Invalid JSON body.", 400, "INVALID_JSON");

  const request = normalizeRequest(body);
  if (!request) return jsonError("Missing readingText.", 400, "INVALID_REQUEST");
  if (request.readingText.length > MAX_READING_CHARS) {
    return jsonError("Reading text is too large. Please shorten it first.", 413, "SOURCE_TOO_LARGE");
  }

  try {
    const h5pRoot = process.env.H5P_ROOT || path.join(process.cwd(), "public", "h5p");
    const templateDir = path.join(h5pRoot, "_templates", "dragtext");
    const templateLibDir = path.join(templateDir, "libraries");
    if (!existsSync(templateDir) || !existsSync(templateLibDir)) {
      return jsonError(
        "Missing H5P DragText template. Expected public/h5p/_templates/dragtext with libraries/ and content/.",
        503,
        "H5P_TEMPLATE_MISSING"
      );
    }

    const generatedId = request.id || `${request.title}-word-order-${Date.now().toString(36)}`;
    const id = safeId(generatedId);
    const writeRoot = process.env.H5P_WRITE_ROOT || h5pRoot;
    const outDir = path.join(writeRoot, id);
    if (existsSync(outDir)) return jsonError(`H5P id already exists: ${id}`, 409, "H5P_ID_EXISTS");

    await fs.cp(templateDir, outDir, { recursive: true });

    const chosen = pickSentences(request.readingText, request.cefrLevel, 8);
    if (!chosen.length) {
      await fs.rm(outDir, { recursive: true, force: true }).catch(() => undefined);
      return jsonError("No usable sentences were found in the supplied reading text.", 422, "NO_USABLE_SENTENCES");
    }

    const textField = chosen.map(wrapEveryWord).join("\n\n");
    const params = buildDragTextParams(textField);

    const templateH5pJsonPath = path.join(templateDir, "h5p.json");
    let mainLibrary = "H5P.DragText";
    let libraryString = "H5P.DragText 1.8";

    if (existsSync(templateH5pJsonPath)) {
      try {
        const templateJson = await readJsonObjectFile(templateH5pJsonPath);
        mainLibrary = firstString(templateJson.mainLibrary) || mainLibrary;
      } catch {
        // Keep the known DragText default when optional template metadata cannot be read.
      }
    }

    const dependencies = await getDependenciesFromLibrariesDir(path.join(outDir, "libraries"));
    const mainDependency = dependencies.find((dependency) => dependency.machineName === mainLibrary);
    if (mainDependency) {
      libraryString = `${mainLibrary} ${mainDependency.majorVersion}.${mainDependency.minorVersion}`;
    }

    const contentJson = {
      library: libraryString,
      params,
      metadata: {
        title: `${request.title} - Word order`,
        license: "U",
        defaultLanguage: "en",
      },
    };

    await fs.mkdir(path.join(outDir, "content"), { recursive: true });
    await fs.writeFile(
      path.join(outDir, "content", "content.json"),
      JSON.stringify(contentJson, null, 2),
      "utf8"
    );

    const h5pJson = {
      title: `${request.title} - Word order`,
      language: "en",
      mainLibrary,
      embedTypes: ["div"],
      preloadedDependencies: dependencies,
    };
    await fs.writeFile(path.join(outDir, "h5p.json"), JSON.stringify(h5pJson, null, 2), "utf8");

    return NextResponse.json({
      ok: true,
      id,
      cefrLevel: request.cefrLevel,
      sentencesUsed: chosen.length,
    });
  } catch (error: unknown) {
    console.error("H5P word-order creation failed", error instanceof Error ? error.message : error);
    return jsonError("Failed to create H5P word-order activity.", 500, "H5P_CREATE_FAILED");
  }
}
