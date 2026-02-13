import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

type Body = {
  id?: string;
  title?: string;
  stage?: number | string | null;
  readingText?: string;
};

function slugify(s: string) {
  return (s || "")
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
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  // Simple sentence split - good enough for MVP
  return t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

function countWords(s: string) {
  // Unicode-safe: letters + combining marks + numbers + apostrophe
  // \u0027 is a plain apostrophe (')
  const m = String(s || "").match(/[\p{L}\p{M}\p{N}\u0027]+/gu);
  return m ? m.length : 0;
}

function pickSentences(text: string, stage: number, max = 8): string[] {
  const sents = splitSentences(text);

  // Stage-based difficulty heuristics
  const st = Number.isFinite(stage) ? stage : 3;
  const minW = st <= 2 ? 4 : st === 3 ? 6 : 7;
  const maxW = st <= 2 ? 8 : st === 3 ? 12 : 16;

  const filtered = sents.filter((s) => {
    const w = countWords(s);
    if (w < minW || w > maxW) return false;
    // avoid super-short fragments or weird punctuation-only lines
    if (!/[\p{L}\p{M}]/u.test(s)) return false;
    return true;
  });

  // Fallback: if nothing fits, just take whatever we have
  const pool = filtered.length ? filtered : sents;

  // Deduplicate-ish (case-insensitive)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of pool) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function wrapEveryWord(sentence: string) {
  // Wrap word tokens in *...* so DragText makes them draggable+blank.
  // Keep punctuation outside.
  return sentence.replace(/([\p{L}\p{M}\p{N}\u0027]+)/gu, "**");
}

function buildDragTextParams(textField: string) {
  return {
    taskDescription:
      "<p><strong>Drag the words into the correct order.</strong></p>\n<p>Tip: read the whole sentence first, then build it left → right.</p>\n",
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

async function readJson(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function getDependenciesFromLibrariesDir(librariesDir: string) {
  // Reads every */library.json under librariesDir and returns preloadedDependencies entries.
  const entries = await fs.readdir(librariesDir, { withFileTypes: true });
  const deps: Array<{ machineName: string; majorVersion: number; minorVersion: number }> = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const libPath = path.join(librariesDir, ent.name, "library.json");
    if (!existsSync(libPath)) continue;

    try {
      const j = await readJson(libPath);
      const machineName = String(j.machineName || "").trim();
      const majorVersion = Number(j.majorVersion);
      const minorVersion = Number(j.minorVersion);
      if (!machineName || !Number.isFinite(majorVersion) || !Number.isFinite(minorVersion)) continue;
      deps.push({ machineName, majorVersion, minorVersion });
    } catch {
      // ignore broken library.json
    }
  }

  // Ensure stable ordering
  deps.sort((a, b) => a.machineName.localeCompare(b.machineName));
  return deps;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const readingText = String(body.readingText || "").trim();
    if (!readingText) {
      return NextResponse.json({ error: "Missing readingText" }, { status: 400 });
    }

    const templateDir = path.join((process.env.H5P_ROOT ?? ""), "_templates", "dragtext");
    const templateLibDir = path.join(templateDir, "libraries");
    if (!existsSync(templateDir) || !existsSync(templateLibDir)) {
      return NextResponse.json(
        {
          error:
            "Missing template at public/h5p/_templates/dragtext. It must include libraries/ and content/.",
        },
        { status: 400 }
      );
    }

    const baseTitle = String(body.title || "Word order").trim() || "Word order";
    const stage = Number(body.stage ?? 3);

    const id =
      safeId(body.id || `${baseTitle}-word-order-${Date.now().toString(36)}`);

    const outDir = path.join((process.env.H5P_WRITE_ROOT ?? (process.env.H5P_ROOT ?? "")), id);
    if (existsSync(outDir)) {
      return NextResponse.json({ error: `H5P id already exists: ${id}` }, { status: 409 });
    }

    // Copy template → new folder
    await fs.cp(templateDir, outDir, { recursive: true });

    // Build content from reading text
    const chosen = pickSentences(readingText, stage, 8);
    const textField = chosen.map(wrapEveryWord).join("\n\n");
    const params = buildDragTextParams(textField);

    // Try to reuse template main library version if present
    const templateH5pJsonPath = path.join(templateDir, "h5p.json");
    let mainLibrary = "H5P.DragText";
    let libraryString = "H5P.DragText 1.8";

    if (existsSync(templateH5pJsonPath)) {
      try {
        const tj = await readJson(templateH5pJsonPath);
        if (tj?.mainLibrary) mainLibrary = String(tj.mainLibrary);
      } catch {
        // ignore
      }
    }

    // Derive dependencies from libraries folder we copied
    const deps = await getDependenciesFromLibrariesDir(path.join(outDir, "libraries"));

    // If we can find the main library in deps, use its version for libraryString
    const mainDep = deps.find((d) => d.machineName === mainLibrary);
    if (mainDep) {
      libraryString = `${mainLibrary} ${mainDep.majorVersion}.${mainDep.minorVersion}`;
    }

    const contentJson = {
      library: libraryString,
      params,
      metadata: {
        title: `${baseTitle} - Word order`,
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
      title: `${baseTitle} - Word order`,
      language: "en",
      mainLibrary,
      embedTypes: ["div"],
      preloadedDependencies: deps,
    };

    await fs.writeFile(path.join(outDir, "h5p.json"), JSON.stringify(h5pJson, null, 2), "utf8");

    return NextResponse.json({ ok: true, id, sentencesUsed: chosen.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create H5P" },
      { status: 500 }
    );
  }
}


