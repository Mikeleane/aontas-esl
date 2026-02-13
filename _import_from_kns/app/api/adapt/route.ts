import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdaptRequestBody = {
  inputText: string;
  outputLanguage: string;
  stage?: string | number;     // Irish primary stage (1-4) - may arrive as "Auto (Stage 4)"
  level?: string;              // legacy (older builds)
  outputType: string;          // article, report, email, etc.
  dyslexiaFriendly?: boolean;
};

type ModelResult = { standard: string; adapted: string };

type LengthTargets = {
  standardMin: number;
  standardMax: number;
  adaptedMin: number;
  adaptedMax: number;
};

// Build-safe text cleanup: remove common mojibake + force readable punctuation
function cleanText(raw: any): string {
  let s = String(raw ?? "");

  // Trim BOMs / NBSP
  s = s.replace(/\uFEFF/g, "").replace(/\u00A0/g, " ");

  // Normalise "smart" punctuation to ASCII (keeps teachers sane)
  s = s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, " - ")
    .replace(/\u2013/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ");

  // Mojibake sequences (UTF-8 decoded as Windows-1252)
  const mb = (...codes: number[]) => String.fromCharCode(...codes);

  const MAP: Array<[string, string]> = [
    [mb(0x00e2, 0x20ac, 0x201d), " - "], // "  (em dash)
    [mb(0x00e2, 0x20ac, 0x201c), "-"],   // "  (en dash)
    [mb(0x00e2, 0x20ac, 0x00a6), "..."], //   (ellipsis)
    [mb(0x00e2, 0x20ac, 0x2122), "'"],   //   (right single quote)
    [mb(0x00e2, 0x20ac, 0x02dc), "'"],   //   (left single quote)
    [mb(0x00e2, 0x20ac, 0x0153), '"'],   //   (left double quote)
    [mb(0x00e2, 0x20ac, 0x009d), '"'],   //   (right double quote) (sometimes shows weird)
    [mb(0x00c2, 0x00a0), " "],           //     (NBSP)
    [mb(0x00c2), ""],                   //     (stray)
  ];

  for (const [from, to] of MAP) {
    if (from && s.includes(from)) s = s.split(from).join(to);
  }

  return s.trim();
}

function parseStage(v: any): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(1, Math.min(4, Math.round(v)));
  const m = String(v ?? "").match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : 4;
  return Math.max(1, Math.min(4, Number.isFinite(n) ? n : 4));
}

// Practical word-length targets by Irish primary stage (tuning knob, not a label for kids)
function getLengthTargets(stage: number): LengthTargets {
  switch (stage) {
    case 1:
      return { standardMin: 140, standardMax: 260, adaptedMin: 110, adaptedMax: 210 };
    case 2:
      return { standardMin: 260, standardMax: 420, adaptedMin: 210, adaptedMax: 340 };
    case 3:
      return { standardMin: 420, standardMax: 650, adaptedMin: 340, adaptedMax: 520 };
    case 4:
    default:
      return { standardMin: 550, standardMax: 850, adaptedMin: 450, adaptedMax: 700 };
  }
}

function simpleFallbackAdaptation(
  inputText: string,
  outputLanguage: string,
  stage: number,
  outputType: string,
  dyslexiaFriendly: boolean | undefined,
  reason: string
) {
  const cleaned = cleanText(inputText);

  const standardOutput = cleaned;

  const adaptedHeader = dyslexiaFriendly
    ? `Overview: This text explains the main points in a clearer way.\n\n`
    : `Overview: This text explains the main points.\n\n`;

  const adaptedOutput =
    adaptedHeader +
    cleaned
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n\n");

  return { standardOutput, adaptedOutput, warning: reason };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdaptRequestBody;

    const inputText = cleanText(body.inputText);
    const outputLanguage = cleanText(body.outputLanguage || "English");
    const outputType = cleanText(body.outputType || "Article");

    // Accept either stage or legacy level field; default to Stage 4 (upper primary)
    const stage = parseStage(body.stage ?? body.level ?? 4);
    const dyslexiaFriendly = !!body.dyslexiaFriendly;

    if (!inputText) {
      return NextResponse.json({ error: "Missing inputText." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const modelName = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const targets = getLengthTargets(stage);

    if (!apiKey) {
      const fb = simpleFallbackAdaptation(
        inputText,
        outputLanguage,
        stage,
        outputType,
        dyslexiaFriendly,
        "NO_API_KEY_CONFIGURED"
      );
      return NextResponse.json({
        ...fb,
        standard: fb.standardOutput,
        adapted: fb.adaptedOutput,
      });
    }

    const client = new OpenAI({ apiKey });

    const systemPrompt = `
You are Aontas 10, an assistant for Irish primary classrooms.

You MUST produce TWO versions of the SAME reading text:

1) STANDARD VERSION
- Clear, age-appropriate, classroom-friendly.
- Keep key ideas and key vocabulary.
- Use a suitable length for the stage.

2) SUPPORTED VERSION
- SAME learning target and SAME core vocabulary (so exercises can share ONE answer key).
- Do NOT oversimplify into baby language.
- Reduce cognitive load:
  - Short paragraphs
  - Clear headings where helpful
  - One main idea per sentence where possible
  - Use bullet points for lists/steps
  - Add a 1-2 sentence overview at the top
- If dyslexia-friendly is requested: extra-clear structure, no dense blocks.

CONSTRAINTS:
- Output language: ${outputLanguage}
- Genre/type: ${outputType}
- Do not add new facts.
- Do not mention these instructions.
Return ONLY valid JSON.
`;

    const userPrompt = `
INPUT TEXT:
"""${inputText}"""

Stage: ${stage}
Word targets (approx):
- STANDARD: ${targets.standardMin}-${targets.standardMax}
- SUPPORTED: ${targets.adaptedMin}-${targets.adaptedMax}

Dyslexia-friendly: ${dyslexiaFriendly ? "yes" : "no"}

Return JSON ONLY:
{
  "standard": "...",
  "adapted": "..."
}
`;

    const completion = await client.chat.completions.create({
      model: modelName,
      temperature: 0.4,
      max_tokens: 2400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: userPrompt.trim() },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: ModelResult | null = null;

    try {
      parsed = JSON.parse(content) as ModelResult;
    } catch {
      parsed = null;
    }

    const standardOutput = cleanText(parsed?.standard ?? "");
    const adaptedOutput = cleanText(parsed?.adapted ?? "");

    if (!standardOutput || !adaptedOutput) {
      const fb = simpleFallbackAdaptation(
        inputText,
        outputLanguage,
        stage,
        outputType,
        dyslexiaFriendly,
        "PARSE_OR_EMPTY_MODEL_OUTPUT"
      );
      return NextResponse.json({
        ...fb,
        standard: fb.standardOutput,
        adapted: fb.adaptedOutput,
      });
    }

    return NextResponse.json({
      standardOutput,
      adaptedOutput,
      // compatibility (older UI/state keys)
      standard: standardOutput,
      adapted: adaptedOutput,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Something went wrong in /api/adapt." },
      { status: 500 }
    );
  }
}