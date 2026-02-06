import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  answer: string | string[];
};

type ExercisesResponse = {
  items: ExerciseItem[];
  error?: string;
  warning?: string;
};

type ErrorResponse = { error: string };
type ExercisesApiResponse = ExercisesResponse | ErrorResponse;


function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function clamp<T>(arr: T[], n: number) {
  return arr.slice(0, Math.max(0, n));
}

function sentences(text: string): string[] {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  const parts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return (parts || []).map((s) => s.trim()).filter(Boolean);
}

function tokens(text: string): string[] {
  const t = String(text || "").toLowerCase();
  const m = t.match(/[a-záéíóúüñ]+(?:'[a-z]+)?/gi);
  return (m || []).map((w) => w.toLowerCase());
}

const STOPWORDS = new Set(
  [
    "the",
    "and",
    "a",
    "an",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "as",
    "at",
    "by",
    "from",
    "that",
    "this",
    "it",
    "they",
    "their",
    "them",
    "he",
    "she",
    "we",
    "you",
    "i",
    "or",
    "but",
    "not",
    "can",
    "could",
    "would",
    "should",
    "will",
    "just",
    "so",
    "if",
    "than",
    "then",
    "about",
    "into",
    "over",
    "after",
    "before",
    "more",
    "most",
    "some",
    "any",
    "all",
    "many",
    "much",
    "very",
    "also",
  ].map((s) => s.toLowerCase())
);

function topSharedWords(standardText: string, adaptedText: string, n = 8): string[] {
  const a = tokens(standardText);
  const b = new Set(tokens(adaptedText));
  const freq = new Map<string, number>();
  for (const w of a) {
    if (!b.has(w)) continue;
    if (w.length < 4) continue;
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return clamp(
    [...freq.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([w]) => w),
    n
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function simpleSummary(standardText: string): string {
  const s = sentences(standardText);
  if (!s.length) return "Sample answer: The text explains the topic and gives key details.";
  const first = s[0];
  const second = s[1] ? " " + s[1] : "";
  return `Sample answer: ${first}${second}`.slice(0, 280);
}

// Very lightweight syllable-ish chunking (heuristic, not a phonics oracle)
function syllableChunks(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return word;
  const vowels = new Set(["a", "e", "i", "o", "u", "y"]);
  const chunks: string[] = [];
  let buf = "";
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    buf += ch;
    const next = w[i + 1];
    const isV = vowels.has(ch);
    const nextIsV = next ? vowels.has(next) : false;
    if (isV && !nextIsV) {
      // cut after vowel when next is consonant cluster
      if (buf.length) {
        chunks.push(buf);
        buf = "";
      }
    }
  }
  if (buf) chunks.push(buf);
  // merge tiny leading chunk
  if (chunks.length > 2 && chunks[0].length === 1) {
    chunks[1] = chunks[0] + chunks[1];
    chunks.shift();
  }
  return chunks.join("-");
}

function fallbackExercises(args: {
  standardText: string;
  adaptedText: string;
  blocks: string[];
  questionFocus?: string;
}): ExercisesResponse {
  const { standardText, adaptedText, blocks } = args;
  const wants = new Set(blocks.map((b) => String(b)));
  const sharedWords = topSharedWords(standardText, adaptedText, 10);
  const sents = sentences(standardText);

  let id = 1;
  const items: ExerciseItem[] = [];

  if (wants.has("gist_main_idea")) {
    const ans = simpleSummary(standardText);
    items.push({
      id: id++,
      type: "gist",
      skill: "Main idea",
      standard: {
        prompt: "In 1–2 sentences, what is the main idea of the text?",
      },
      adapted: {
        prompt:
          "In 1 sentence, what is the text mostly about? Tip: start with ‘This text is about…’.",
      },
      answer: ans,
    });
  }

  if (wants.has("detail_questions")) {
    const pick = clamp(sents, 3);
    const ans = pick.length
      ? `Sample answers (from the text):\n- ${pick.join("\n- ")}`
      : "Sample answers: Use details from the text.";
    items.push({
      id: id++,
      type: "detail",
      skill: "Key details",
      standard: {
        prompt:
          "Find 3 key details from the text. Write them as short bullet points.",
      },
      adapted: {
        prompt:
          "Find 3 key details. Use starters: ‘One detail is…’, ‘Another detail is…’, ‘A third detail is…’.",
      },
      answer: ans,
    });
  }

  if (wants.has("vocabulary")) {
    const words = clamp(sharedWords, 6);
    const ans = words.length
      ? `Words (from the text): ${words.join(", ")}`
      : "Words: (choose 6 interesting words from the text).";
    items.push({
      id: id++,
      type: "vocab",
      skill: "Vocabulary (in-context)",
      standard: {
        prompt:
          "Choose 6 words from the text. For each word: (1) copy the sentence it appears in, and (2) write a short meaning in your own words.",
      },
      adapted: {
        prompt:
          "Find these words in the text and write a short meaning (or draw a quick symbol): " +
          (words.length ? words.join(", ") : "(teacher chooses)") +
          ".",
      },
      answer: ans,
    });
  }

  if (wants.has("true_false")) {
    const w1 = sharedWords[0] || "the topic";
    const w2 = sharedWords[1] || "a detail";
    items.push({
      id: id++,
      type: "trueFalse",
      skill: "True / False",
      standard: {
        prompt: `Decide if each statement is True or False:\n1) The text mentions “${w1}”.\n2) The text mentions “unicorns” as a key detail.`,
        options: ["True", "False"],
      },
      adapted: {
        prompt: `True or False?\n1) I can find “${w1}” in the text.\n2) I can find “unicorns” in the text.`,
        options: ["True", "False"],
      },
      answer: ["True", "False"],
    });
  }

  if (wants.has("cloze_gapfill")) {
    const base = sents.length ? sents[Math.min(2, sents.length - 1)] : standardText;
    const blanks = clamp(sharedWords, 5);
    let cloze = base;
    const answers: string[] = [];
    for (const w of blanks) {
      const re = new RegExp(`\\b${w}\\b`, "i");
      if (re.test(cloze)) {
        cloze = cloze.replace(re, "_____");
        answers.push(w);
      }
    }
    items.push({
      id: id++,
      type: "cloze",
      skill: "Cloze / gap-fill",
      standard: {
        prompt:
          "Complete the sentence by filling the gaps. Use the word bank.\n\n" +
          cloze +
          "\n\nWord bank: " +
          answers.join(", "),
      },
      adapted: {
        prompt:
          "Fill in the gaps using the word bank.\n\n" +
          cloze +
          "\n\nWord bank: " +
          answers.join(", "),
      },
      answer: answers,
    });
  }

  if (wants.has("ordering")) {
    const pick = clamp(sents.slice(0, 6), 4);
    const correct = pick.length ? pick : ["First…", "Then…", "Next…", "Finally…"];
    const shuffled = shuffle(correct);
    items.push({
      id: id++,
      type: "ordering",
      skill: "Ordering",
      standard: {
        prompt:
          "Put these events/ideas in the correct order (1–4):\n" +
          shuffled.map((x, i) => `${i + 1}) ${x}`).join("\n"),
      },
      adapted: {
        prompt:
          "Number the sentences in the correct order (1–4):\n" +
          shuffled.map((x, i) => `${i + 1}) ${x}`).join("\n"),
      },
      answer: correct,
    });
  }

  if (wants.has("word_study")) {
    const words = clamp(sharedWords.filter((w) => w.length >= 5), 6);
    const picks = clamp(words, 4);
    const breakdowns = picks.map((w) => `${w} → ${syllableChunks(w)}`);
    items.push({
      id: id++,
      type: "wordStudy",
      skill: "Word study (break down words)",
      standard: {
        prompt:
          "Break down each word. Add hyphens for syllable-like chunks, and circle any prefix/suffix you notice.\n\nWords: " +
          (picks.length ? picks.join(", ") : "(choose 4 words from the text)"),
      },
      adapted: {
        prompt:
          "Break down each word using hyphens. Tip: clap the parts as you say the word.\n\nWords: " +
          (picks.length ? picks.join(", ") : "(teacher chooses)"),
      },
      answer: breakdowns.length ? breakdowns : "Sample answers: add hyphens to show the parts.",
    });
  }

  return {
    items,
    warning: "NO_API_KEY_CONFIGURED",
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const standardText: string =
      body.standardText || body.standardOutput || body.standard || "";
    const adaptedText: string =
      body.adaptedText || body.adaptedOutput || body.adapted || "";

    const outputLanguage: string = body.outputLanguage || body.language || "English";
    const level: string = body.level || body.cefrLevel || "B1";
    const outputType: string = body.textType || body.outputType || "Article";
    const questionFocus: string = body.questionFocus || "Balanced comprehension";

    const rawBlocks =
      (Array.isArray(body.blocks) && body.blocks) ||
      (Array.isArray(body.selectedBlocks) && body.selectedBlocks) ||
      [];

    const enabledBlocks: string[] =
      rawBlocks.length > 0
        ? rawBlocks.map((b: any) => String(b))
        : ["gist_main_idea", "detail_questions", "vocabulary"]; // sensible default

    // Fallback mode (lets you test the full pipeline without keys)
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        fallbackExercises({
          standardText,
          adaptedText,
          blocks: enabledBlocks,
          questionFocus,
        })
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const wants = new Set(enabledBlocks);

    const prompt = `
You are an expert primary-school ELA teacher.

TASK:
Generate an EXERCISES PACK for a whole-class lesson using TWO versions of the same text:
1) STANDARD text (grade-level)
2) SUPPORTED text (same learning target, more accessible)

CRITICAL RULES:
- The class works together: every exercise MUST share ONE single answer key.
- Standard and Supported versions can have different scaffolds, but answers must match.
- Do not oversimplify the Supported version: keep the same learning target.
- Keep wording age-appropriate and classroom-friendly.
- Output language: ${outputLanguage}
- Reading level: ${level}
- Text type: ${outputType}
- Question focus: ${questionFocus}

TEXTS:
STANDARD:
"""
${standardText}
"""

SUPPORTED:
"""
${adaptedText}
"""

EXERCISE BLOCKS TO GENERATE:
${enabledBlocks.map((b) => `- ${b}`).join("\n")}

WHAT TO RETURN:
Return valid JSON ONLY (no markdown) in this exact shape:
{
  "items": [
    {
      "id": 1,
      "type": "gist|detail|vocab|trueFalse|cloze|ordering|wordStudy",
      "skill": "...",
      "standard": { "prompt": "...", "options": ["..."]? },
      "adapted": { "prompt": "...", "options": ["..."]? },
      "answer": "..." OR ["...", "..."]
    }
  ]
}

BLOCK GUIDANCE:
- gist_main_idea: 1–2 items on main idea / headline / summary.
- detail_questions: 3–5 items that require evidence from the text.
- vocabulary: 2–4 items, in-context meaning, matching, or using words in sentences.
- true_false: 3–5 statements; keep the Supported version simpler (shorter statements, fewer distractors) BUT SAME T/F answers.
- cloze_gapfill: 1–2 cloze tasks. Use the SAME missing words/answers in both versions; Supported can include a word bank.
- ordering: 1 item ordering events/steps. Supported can provide numbered boxes.
- word_study: 2–3 items that help students break down words (syllables, prefixes/suffixes, word families, phoneme-grapheme patterns).
  * Only use words that appear in BOTH texts.
  * Keep answers objective (e.g., syllable splits with hyphens, prefix/root/suffix labels, or grapheme highlights).

QUALITY CONTROL:
- Do not invent facts.
- Keep it printable.
- Ensure every item has a clear answer.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    const content = completion.choices[0]?.message?.content?.trim() || "";
    const parsed = safeJsonParse<ExercisesResponse>(content);

    if (!parsed || !Array.isArray(parsed.items)) {
      return NextResponse.json(
        { error: "Failed to parse exercises JSON." } satisfies ErrorResponse,
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Exercises generation failed." } satisfies ErrorResponse,
      { status: 500 }
    );
  }
}


