import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aontas 10 (Kilgobnet N.S.) — /api/exercises
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
 */

type ExerciseSide = {
  prompt: string;
  options?: string[];
};

type ExerciseItem = {
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

function fixMojibake(s: string): string {
  // Common UTF-8/Windows-1252 mojibake seen in copied text / exports
  return String(s || "")
    .replace(/\u00c2/g, "")
    .replace(/ÃƒÂ¢Ã¢â‚¬Â\s*Ã¢â‚¬â„¢/g, "-")
    .replace(/Ã¢â‚¬â€œ/g, "-")
    .replace(/Ã¢â‚¬â€/g, "-")
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã¢â‚¬Â¦/g, "...")
    .replace(/â€“/g, "-")
    .replace(/â€”/g, "-")
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"');
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
  return t || "detail";
}

function extractWordsIntersection(a: string, b: string): string[] {
  const wa = new Set(
    String(a || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4)
  );

  const wb = new Set(
    String(b || "")
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

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  // Two true, two false. Keep it safe and objective.
  const shared = args.sharedWords.filter((w) => w.length >= 4).slice(0, 6);
  const ents =
    (args.standardText.match(/\b[A-Z][a-z]{2,}\b/g) || [])
      .filter((w) => !["The", "This", "That", "After", "When", "While"].includes(w))
      .slice(0, 6);

  const trueStmt1 = shared[0] ? `The text includes the word "${shared[0]}".` : `The text describes a real situation.`;
  const trueStmt2 = ents[0] ? `The text mentions "${ents[0]}".` : shared[1] ? `The text includes the word "${shared[1]}".` : `The text gives details about the topic.`;

  const falseStmt1 = `The text says the story is set on Mars.`;
  const falseStmt2 = `The text says the main topic is unicorns.`;

  const statements = [trueStmt1, trueStmt2, falseStmt1, falseStmt2];
  const answers: ("True" | "False")[] = ["True", "True", "False", "False"];
  return buildTrueFalseItem({ id: args.id, statements, answers });
}

function pickWordStudyWords(sharedWords: string[]): string[] {
  const candidates = sharedWords.filter((w) => w.length >= 6).slice(0, 18);
  const picked = shuffle(candidates).slice(0, 4);
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
}): { items: ExerciseItem[]; warning?: string } {
  const warn: string[] = [];
  let nextId = 1;

  const out: ExerciseItem[] = [];
  const singletonTypes = new Set<string>(["wordStudy", "trueFalse", "cloze", "ordering", "gist"]);
  const seenSingleton = new Set<string>();

  for (const raw of args.items || []) {
    const type = normalizeType(String((raw as any).type || ""));

    // dedupe singleton blocks (prevents double word study, etc.)
    if (singletonTypes.has(type)) {
      if (seenSingleton.has(type)) {
        warn.push(`deduped_${type}`);
        continue;
      }
      seenSingleton.add(type);
    }

    // Force sequential ids (stable teacher keys)
    const item: ExerciseItem = { ...(raw as any), id: nextId++ } as any;

    // Ensure fields exist + clean mojibake
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

      // Extract word bank inside [...] if present
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

        // Rewrite prompts to use the repaired bank (keep it identical across streams)
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

        // Normalise answer to an array (stable for teacher key)
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

    // Default: pass-through (detail/vocab/etc.)
    out.push(item);
  }

  return { items: out, warning: warn.length ? warn.join(",") : undefined };
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

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";
    const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    if (!apiKey) {
      // Minimal deterministic fallback (still respects shared answer key)
      const items: ExerciseItem[] = [];
      const sanitized = sanitizeItems({
        items,
        standardText,
        adaptedText,
        sharedWords,
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
IMPORTANT: Every question MUST share ONE answer key across both streams.

Return JSON only.`;

    const user = `Create exercises for:
Language: ${outputLanguage}
Text type: ${outputType}
Focus: ${questionFocus}
Class: ${schoolClass ?? "?"}
Stage: ${stage ?? "?"}

Blocks requested: ${blocks.join(", ")}

STANDARD TEXT:
${standardText}

SUPPORTED TEXT:
${adaptedText}

Rules:
- Use the following JSON shape:
{
  "items": [
    {
      "id": 1,
      "type": "detail|vocab|trueFalse|cloze|ordering|wordStudy|gist",
      "skill": "short label",
      "standard": { "prompt": "...", "options": ["..."]? },
      "adapted": { "prompt": "...", "options": ["..."]? },
      "answer": "..." | ["..."] | [1,2,3]
    }
  ]
}

Guardrails:
- For True/False: if you create multiple statements, put them as numbered lines in the prompt (1) ... 2) ...
  and provide an answer array with the SAME length, like ["True","False",...].
- For Cloze: the word bank shown to students must contain all the answer words.
- For Word Study: choose words that appear in BOTH texts (shared words).
Shared words candidates: ${sharedWords.join(", ")}.
`;

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
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
