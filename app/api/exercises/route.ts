import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aontas 10 (Kilgobnet N.S.) /api/exercises
 *
 * Inclusive-by-design:
 * - TWO streams (STANDARD + SUPPORTED) for ONE class
 * - Shared answer key across streams
 *
 * Hard guardrails in code:
 * - True/False statements are forced to be IDENTICAL across both streams.
 * - Cloze word bank always contains all answer words.
 * - Word Study uses ONLY words that appear in BOTH texts (intersection list).
 * - Singleton exercise types are deduped (no double Word Study, etc.).
 * - Word Study selection is deterministic (no randomness).
 */

type ExerciseSide = {
  prompt: string;
  options?: string[];
};

type ExerciseItem = {
  /**
   * Index of the correct option for multiple-choice questions (0-based).
   * This lets Standard and Supported share ONE answer key even if option text is paraphrased.
   */
  answerIndex?: number;

  id: number;
  type: string;
  skill: string;
  standard: ExerciseSide;
  adapted: ExerciseSide;
  answer: string | string[] | number[];
};

type ExercisesResponse = {
  items?: ExerciseItem[];
  warning?: string;
  error?: string;
};

type ErrorResponse = { error: string };

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * IMPORTANT:
 * Avoid “mystery character classes” like /['’]/ if the source encoding can be corrupted.
 * Use explicit Unicode escapes so we never accidentally match normal letters (like "u").
 */
function fixMojibake(input: any): string {
  let s = String(input ?? "");

  // Strip C1 controls (U+0080..U+009F) which can break parsing/rendering.
  s = s.replace(/[\u0080-\u009F]/g, "");

  // Common UTF-8→Win1252 mojibake sequences (explicit escapes, safe in source files).
  const reps: Array<[RegExp, string]> = [
    // Apostrophes/quotes (mojibake)
    [/\u00e2\u20ac\u2122/g, "'"], // â€™
    [/\u00e2\u20ac\u02dc/g, "'"], // â˜
    [/\u00e2\u20ac\u0153/g, '"'], // â€œ
    [/\u00e2\u20ac\u009d/g, '"'], // â€  (often shows with control)
    // Dashes (mojibake)
    [/\u00e2\u20ac\u201c/g, "-"], // â€“
    [/\u00e2\u20ac\u201d/g, "-"], // â—
    // Ellipsis (mojibake)
    [/\u00e2\u20ac\u00a6/g, "..."], // â€¦
    // Stray Â (NBSP artifacts)
    [/\u00c2/g, ""],
  ];

  for (const [re, to] of reps) s = s.replace(re, to);

  // Normalize real Unicode punctuation (smart quotes/dashes/ellipsis) safely.
  s = s
    .replace(/[\u201C\u201D]/g, '"') // “ ”
    .replace(/[\u2018\u2019]/g, "'") // ‘ ’
    .replace(/[\u2013\u2014]/g, "-") // – —
    .replace(/\u2026/g, "..."); // …

  // Collapse weird whitespace but KEEP newlines (important for paragraphing elsewhere).
  s = s.replace(/\u00a0/g, " "); // NBSP to space
  s = s.replace(/[ \t]+/g, " "); // collapse spaces/tabs only

  return s.trim();
}

function normForMatch(s: string): string {
  return fixMojibake(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferAnswerIndex(answer: any, options?: string[]): number | undefined {
  if (!Array.isArray(options) || options.length < 2) return undefined;

  const a = fixMojibake(answer);

  // Formats: "A".."D"
  const letter = a.match(/^\s*([A-D])\s*$/i);
  if (letter) {
    const idx = letter[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
    return idx >= 0 && idx < options.length ? idx : undefined;
  }

  // Formats: "1".."n"
  const num = a.match(/^\s*([1-9][0-9]*)\s*$/);
  if (num) {
    const idx = Math.max(0, parseInt(num[1], 10) - 1);
    return idx >= 0 && idx < options.length ? idx : undefined;
  }

  // Exact-ish text match
  const na = normForMatch(a);
  if (!na) return undefined;

  for (let i = 0; i < options.length; i++) {
    if (normForMatch(options[i]) === na) return i;
  }

  // Partial containment fallback
  for (let i = 0; i < options.length; i++) {
    const no = normForMatch(options[i]);
    if (no && (na.includes(no) || no.includes(na))) return i;
  }

  return undefined;
}

function tokenSet(s: string): Set<string> {
  return new Set(normForMatch(s).split(/\s+/).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

/**
 * If Supported options look re-ordered, try to align them to the Standard option order.
 * We only do this when we can do it confidently.
 */
function alignSupportedOptions(std: string[], sup: string[]): string[] {
  if (std.length !== sup.length || std.length < 2) return sup;

  const used = new Set<number>();
  const supSets = sup.map(tokenSet);
  const stdSets = std.map(tokenSet);

  const out: string[] = [];
  let scoreSum = 0;

  for (let i = 0; i < std.length; i++) {
    let bestJ = -1;
    let bestIdx = -1;
    for (let j = 0; j < sup.length; j++) {
      if (used.has(j)) continue;
      const sc = jaccard(stdSets[i], supSets[j]);
      if (sc > bestJ) {
        bestJ = sc;
        bestIdx = j;
      }
    }
    if (bestIdx === -1) return sup; // give up
    used.add(bestIdx);
    out.push(sup[bestIdx]);
    scoreSum += bestJ;
  }

  const avg = scoreSum / std.length;
  return avg >= 0.22 ? out : sup;
}

function cleanSide(side: ExerciseSide): ExerciseSide {
  return {
    prompt: fixMojibake(String(side?.prompt || "")).trim(),
    options: Array.isArray(side?.options)
      ? side.options.map((o) => fixMojibake(String(o)).trim()).filter(Boolean)
      : undefined,
  };
}

function parseListAnswer(ans: unknown): string[] {
  if (Array.isArray(ans)) {
    return ans.map((x) => fixMojibake(String(x))).map((s) => s.trim()).filter(Boolean);
  }
  const s = fixMojibake(String(ans || "")).trim();
  if (!s) return [];
  return s.split(/[;\n,]+/).map((x) => x.trim()).filter(Boolean);
}

function normalizeType(type: string): string {
  const t = String(type || "").trim();
  const low = t.toLowerCase();
  if (low === "word_study") return "wordStudy";
  if (low === "true_false") return "trueFalse";
  if (low === "cloze_gapfill" || low === "gap_fill" || low === "gapfill") return "cloze";
  if (low === "ordering" || low === "sequence" || low === "order") return "ordering";
  if (low === "gist_main" || low === "gist") return "gist";
  if (!t) return "detail";
  return t;
}

function extractWordsIntersection(a: string, b: string): string[] {
  const wa = new Set(
    fixMojibake(a)
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4)
  );

  const wb = new Set(
    fixMojibake(b)
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4)
  );

  const both = [...wa].filter((w) => wb.has(w));
  both.sort((x, y) => y.length - x.length);
  return both.slice(0, 24);
}

function syllableChunks(word: string) {
  const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 4) return w;
  return w
    .replace(/([aeiouy]+[^aeiouy]+)/g, "$1-")
    .replace(/-+$/g, "")
    .replace(/--+/g, "-");
}

function extractNumberedStatements(prompt: string): string[] {
  const lines = String(prompt || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const l of lines) {
    const m = l.match(/^\s*\d+\)\s*(.+)\s*$/);
    if (m && m[1]) out.push(m[1].trim());
  }
  return out;
}

function buildTrueFalseItem(args: {
  id: number;
  statements: string[];
  answers: ("True" | "False")[];
}): ExerciseItem {
  const numbered = args.statements.map((s, i) => `${i + 1}) ${s}`).join("\n");
  return {
    id: args.id,
    type: "trueFalse",
    skill: "True / False",
    standard: {
      prompt: `Decide if each statement is True or False:\n${numbered}`,
      options: ["True", "False"],
    },
    adapted: {
      prompt: `True or False? Tick one.\n${numbered}`,
      options: ["True", "False"],
    },
    answer: args.answers,
  };
}

function deterministicTrueFalse(args: {
  id: number;
  standardText: string;
  adaptedText: string;
  sharedWords: string[];
}): ExerciseItem {
  const shared = args.sharedWords.filter((w) => w.length >= 4).slice(0, 6);
  const ents =
    (fixMojibake(args.standardText).match(/\b[A-Z][a-z]{2,}\b/g) || [])
      .filter((w) => !["The", "This", "That", "After", "When", "While"].includes(w))
      .slice(0, 6);

  const trueStmt1 = shared[0]
    ? `The text includes the word "${shared[0]}".`
    : `The text includes key details about the topic.`;
  const trueStmt2 = ents[0]
    ? `The text mentions "${ents[0]}".`
    : shared[1]
      ? `The text includes the word "${shared[1]}".`
      : `The text describes real people or places.`;

  const falseStmt1 = `The text says the story is set on Mars.`;
  const falseStmt2 = `The text says the main topic is unicorns.`;

  return buildTrueFalseItem({
    id: args.id,
    statements: [trueStmt1, trueStmt2, falseStmt1, falseStmt2],
    answers: ["True", "True", "False", "False"],
  });
}

/**
 * Deterministic Word Study pick:
 * sharedWords is already sorted by length (desc). We take first 4 “good” candidates.
 */
function pickWordStudyWords(sharedWords: string[]): string[] {
  const candidates = sharedWords.filter((w) => w.length >= 6);
  const picked = candidates.slice(0, 4);
  return picked.length ? picked : sharedWords.slice(0, 4);
}

function buildWordStudyItem(args: { id: number; sharedWords: string[] }): ExerciseItem {
  const picks = pickWordStudyWords(args.sharedWords);
  const breakdowns = picks.map((w) => `${w} - ${syllableChunks(w)}`);

  const wordList = picks.length ? picks.join(", ") : "(choose 4 shared words from the text)";
  return {
    id: args.id,
    type: "wordStudy",
    skill: "Word study (break down words)",
    standard: {
      prompt:
        "Break down each word. Add hyphens for syllable-like chunks, and circle any prefix/suffix you notice.\n\nWords: " +
        wordList,
    },
    adapted: {
      prompt:
        "Break down each word using hyphens. Tip: clap the parts as you say the word.\n\nWords: " +
        wordList,
    },
    answer: breakdowns,
  };
}

/* --------------------------- Post-process guard --------------------------- */

function sanitizeItems(args: {
  items: ExerciseItem[];
  standardText: string;
  adaptedText: string;
  sharedWords: string[];
  maxItems: number;
}): { items: ExerciseItem[]; warning?: string } {
  const warn: string[] = [];
  let nextId = 1;

  const out: ExerciseItem[] = [];
  const singletonTypes = new Set<string>(["wordStudy", "trueFalse", "cloze", "ordering", "gist"]);
  const seenSingleton = new Set<string>();

  for (const raw of args.items || []) {
    const type = normalizeType(String((raw as any).type || ""));

    // dedupe singleton blocks
    if (singletonTypes.has(type)) {
      if (seenSingleton.has(type)) {
        warn.push(`deduped_${type}`);
        continue;
      }
      seenSingleton.add(type);
    }

    // Force sequential ids
    const item: ExerciseItem = { ...(raw as any), id: nextId++ } as any;

    // Normalize type & clean mojibake
    item.type = type;
    item.skill = fixMojibake(String((item as any).skill || "")).trim() || type;

    item.standard = cleanSide((item as any).standard || { prompt: "" });
    item.adapted = cleanSide((item as any).adapted || { prompt: "" });

    // ---- True/False: enforce shared statements + robust answers ----
    if (type === "trueFalse") {
      const anyRaw: any = raw as any;

      const stdPromptRaw = fixMojibake(String(item.standard.prompt || "")).trim();
      const stmtsFromPrompt = extractNumberedStatements(stdPromptRaw);

      const stmtsFromTop = Array.isArray(anyRaw.options)
        ? anyRaw.options
        : Array.isArray(anyRaw.statements)
          ? anyRaw.statements
          : [];

      const stmtsFromTopClean = (stmtsFromTop || [])
        .map((x: any) => fixMojibake(String(x || "")).trim())
        .filter(Boolean);

      const statements = (stmtsFromPrompt.length ? stmtsFromPrompt : stmtsFromTopClean).slice(0, 8);

      if (!statements.length) {
        warn.push("true_false_repaired");
        out.push(
          deterministicTrueFalse({
            id: item.id,
            standardText: args.standardText,
            adaptedText: args.adaptedText,
            sharedWords: args.sharedWords,
          })
        );
        continue;
      }

      // Parse answers
      let answers: ("True" | "False")[] = [];
      if (Array.isArray((item as any).answer)) {
        const arr = (item as any).answer as any[];
        if (arr.length === statements.length) {
          answers = arr.map((x) => (String(x).toLowerCase().startsWith("t") ? "True" : "False")) as any;
        }
      } else {
        const parsed = parseListAnswer((item as any).answer);
        if (parsed.length === statements.length) {
          answers = parsed.map((x) => (String(x).toLowerCase().startsWith("t") ? "True" : "False")) as any;
        }
      }

      if (!answers.length || answers.length !== statements.length) {
        warn.push("true_false_repaired");
        out.push(
          deterministicTrueFalse({
            id: item.id,
            standardText: args.standardText,
            adaptedText: args.adaptedText,
            sharedWords: args.sharedWords,
          })
        );
        continue;
      }

      out.push(buildTrueFalseItem({ id: item.id, statements, answers }));
      continue;
    }

    // ---- Cloze: ensure word bank contains every answer word ----
    if (type === "cloze") {
      const stdP = String(item.standard.prompt || "");
      const ansWords = parseListAnswer((item as any).answer);

      const m = stdP.match(/\[([^\]]+)\]/);
      const bankRaw = m ? m[1] : "";
      const bank = bankRaw
        ? bankRaw.split(",").map((x) => fixMojibake(x).trim()).filter(Boolean)
        : [];

      if (ansWords.length) {
        const bankSet = new Set(bank.map((w) => w.toLowerCase()));
        const merged: string[] = [...bank];

        for (const a of ansWords) {
          const key = a.toLowerCase();
          if (!bankSet.has(key)) {
            bankSet.add(key);
            merged.push(a);
            warn.push("cloze_bank_repaired");
          }
        }

        if (m) {
          const newBankStr = `[${merged.join(", ")}]`;
          const nextStd = stdP.replace(/\[[^\]]+\]/, newBankStr);
          const nextAdp = String(item.adapted.prompt || "").replace(/\[[^\]]+\]/, newBankStr);
          item.standard.prompt = nextStd;
          item.adapted.prompt = nextAdp.includes("[") ? nextAdp : nextStd;
        } else if (merged.length) {
          const bankLine = `\n\nWord bank: [${merged.join(", ")}]`;
          item.standard.prompt = stdP + bankLine;
          item.adapted.prompt = String(item.adapted.prompt || stdP) + bankLine;
        }

        (item as any).answer = ansWords;
      }

      out.push(item);
      continue;
    }

    // ---- Word study: deterministic, shared-words only ----
    if (type === "wordStudy") {
      out.push(buildWordStudyItem({ id: item.id, sharedWords: args.sharedWords }));
      continue;
    }

    // Default: pass-through
    // Ensure Supported options stay aligned with Standard so the shared answer key works.
    if (Array.isArray(item.standard.options) && Array.isArray(item.adapted.options)) {
      item.adapted.options = alignSupportedOptions(item.standard.options, item.adapted.options);
    }

    const idx = inferAnswerIndex((item as any).answer, item.standard.options);
    if (typeof idx === "number" && Number.isFinite(idx)) (item as any).answerIndex = idx;

    out.push(item);
  }

  // Cap total items (reduces teacher/student load)
  const capped = out.slice(0, Math.max(1, args.maxItems));
  if (out.length > capped.length) warn.push("items_capped");

  return { items: capped, warning: warn.length ? warn.join(",") : undefined };
}

/* ------------------------------ Main handler ------------------------------ */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const standardText: string = body.standardText || body.standardOutput || body.standard || "";
    const adaptedText: string = body.adaptedText || body.adaptedOutput || body.adapted || "";

    const outputLanguage: string = body.outputLanguage || body.language || "English";
    const outputType: string = body.textType || body.outputType || "Article";
    const questionFocus: string = body.questionFocus || "Balanced comprehension";

    const schoolClass: number | undefined = Number.isFinite(body.schoolClass) ? Number(body.schoolClass) : undefined;
    const stage: number | undefined = Number.isFinite(body.stage) ? Number(body.stage) : undefined;

    const rawBlocks =
      (Array.isArray(body.blocks) && body.blocks) ||
      (Array.isArray(body.exerciseBlocks) && body.exerciseBlocks) ||
      [];

    const blocks = rawBlocks.map((x: any) => String(x || "").trim()).filter(Boolean);

    const sharedWords = extractWordsIntersection(standardText, adaptedText);

    // Reasonable “Irish primary” defaults:
    // one question per requested block, capped.
    const maxItems = Math.min(10, Math.max(4, blocks.length || 6));

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";
    const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    if (!apiKey) {
      const sanitized = sanitizeItems({
        items: [],
        standardText,
        adaptedText,
        sharedWords,
        maxItems,
      });

      return NextResponse.json({
        items: sanitized.items,
        warning: "NO_API_KEY_CONFIGURED" + (sanitized.warning ? `;${sanitized.warning}` : ""),
      } satisfies ExercisesResponse);
    }

    const client = new OpenAI({ apiKey });

    const system = `You generate reading comprehension exercises for ONE class with TWO streams:
- Standard
- Supported (reduced cognitive load, same learning target)

ABSOLUTE REQUIREMENT: ONE shared answer key across both streams.
- For multiple-choice: keep option ORDER aligned and include answerIndex (0-based).
- Return JSON only. No markdown, no commentary.

OUTPUT CONTROL:
- Create EXACTLY one exercise per requested block (unless a block is impossible).
- Keep total items <= ${maxItems}.`;

    const user = `Create exercises for:
Language: ${outputLanguage}
Text type: ${outputType}
Focus: ${questionFocus}
Class: ${schoolClass ?? "?"}
Stage: ${stage ?? "?"}

Blocks requested (make one item per block, in this order): ${blocks.join(", ")}

STANDARD TEXT:
${standardText}

SUPPORTED TEXT:
${adaptedText}

JSON shape:
{
  "items": [
    {
      "id": 1,
      "type": "detail|vocab|trueFalse|cloze|ordering|wordStudy|gist",
      "skill": "short label",
      "standard": { "prompt": "...", "options": ["..."]? },
      "adapted": { "prompt": "...", "options": ["..."]? },
      "answerIndex": 0?,
      "answer": "..." | ["..."] | [1,2,3]
    }
  ]
}

Guardrails:
- True/False: statements must be numbered in the prompt (1) ... 2) ... and answer must be an array of matching length.
- Cloze: the visible word bank must contain ALL answer words.
- Word Study: choose words that appear in BOTH texts only.
Shared words candidates: ${sharedWords.join(", ")}.

Keep prompts short and classroom-friendly.`;

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const parsed = safeJsonParse<{ items: ExerciseItem[] }>(raw);

    const items = parsed?.items || [];

    const sanitized = sanitizeItems({
      items,
      standardText,
      adaptedText,
      sharedWords,
      maxItems,
    });

    return NextResponse.json({
      items: sanitized.items,
      warning: sanitized.warning,
    } satisfies ExercisesResponse);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Exercises generation failed." } satisfies ErrorResponse,
      { status: 500 }
    );
  }
}
