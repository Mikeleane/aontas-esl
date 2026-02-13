import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

// ---------------- Types (mirrors app/_features/reading/readingPackTypes.ts) ----------------

type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

type ExerciseType =
  | "mcq"
  | "true_false"
  | "short_answer"
  | "matching"
  | "gap_fill"
  | "sequencing"
  | "vocab";

type ExerciseVariant = {
  prompt: string;
  options?: string[];
  supports?: string[]; // only really used on SUPPORTED
};

type ExerciseItem = {
  id: string;
  type: ExerciseType;
  answer: string | string[];
  standard: ExerciseVariant;
  SUPPORTED: ExerciseVariant;
};

type ReadingPackData = {
  title: string;
  stage: number;
  schoolClass?: number;
  cefrLevel?: CefrLevel;
  reading: {
    standard: string;
    SUPPORTED: string;
  };
  exercises: ExerciseItem[];
};

// ---------------- Helpers ----------------

function parseCefrLevel(v: unknown): CefrLevel {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "A1" || s === "A2" || s === "B1" || s === "B2" || s === "C1" || s === "C2") return s;
  return "B1";
}

function cefrToStageBand(level: CefrLevel): number {
  // Rough, pragmatic mapping for ESL packs.
  // Stage here is your internal 1-4 reading band.
  switch (level) {
    case "A1":
      return 1;
    case "A2":
      return 2;
    case "B1":
      return 3;
    case "B2":
    case "C1":
    case "C2":
      return 4;
  }
}

function stageTargets(stage: number) {
  // word-count targets (soft targets)
  switch (stage) {
    case 1:
      return { words: [120, 220], lines: [8, 14] };
    case 2:
      return { words: [220, 360], lines: [12, 20] };
    case 3:
      return { words: [360, 600], lines: [16, 28] };
    default:
      return { words: [650, 950], lines: [22, 40] };
  }
}

function safeJsonExtract(text: string): string {
  // Attempt to extract the first JSON object from a mixed response.
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return text.slice(firstBrace, lastBrace + 1);
  return text;
}

function validatePack(raw: any): ReadingPackData {
  if (!raw || typeof raw !== "object") throw new Error("Model returned non-object.");

  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Untitled pack";
  const stage = Number.isFinite(Number(raw.stage)) ? Number(raw.stage) : 3;
  const schoolClass = Number.isFinite(Number(raw.schoolClass)) ? Number(raw.schoolClass) : undefined;
  const cefrLevel = raw.cefrLevel ? parseCefrLevel(raw.cefrLevel) : undefined;

  const readingStd = raw.reading?.standard;
  const readingSup = raw.reading?.SUPPORTED;
  if (typeof readingStd !== "string" || typeof readingSup !== "string") {
    throw new Error("Missing reading.standard / reading.SUPPORTED.");
  }

  const exercises: ExerciseItem[] = Array.isArray(raw.exercises) ? raw.exercises : [];
  if (exercises.length < 6) {
    throw new Error("Not enough exercises. Expected at least 6.");
  }

  // Basic normalization + guards
  const cleaned = exercises.slice(0, 12).map((e, idx) => {
    const id = typeof e?.id === "string" && e.id.trim() ? e.id.trim() : `ex_${idx + 1}`;
    const type: ExerciseType =
      e?.type === "mcq" ||
      e?.type === "true_false" ||
      e?.type === "short_answer" ||
      e?.type === "matching" ||
      e?.type === "gap_fill" ||
      e?.type === "sequencing" ||
      e?.type === "vocab"
        ? e.type
        : "short_answer";

    const answer = typeof e?.answer === "string" || Array.isArray(e?.answer) ? e.answer : "";

    const stdPrompt = String(e?.standard?.prompt ?? "").trim();
    const supPrompt = String(e?.SUPPORTED?.prompt ?? "").trim();
    if (!stdPrompt || !supPrompt) throw new Error(`Exercise ${id} missing prompts.`);

    const stdOptions = Array.isArray(e?.standard?.options) ? e.standard.options.map(String) : undefined;
    const supOptions = Array.isArray(e?.SUPPORTED?.options) ? e.SUPPORTED.options.map(String) : undefined;

    const supSupports = Array.isArray(e?.SUPPORTED?.supports)
      ? e.SUPPORTED.supports.map(String).filter(Boolean)
      : undefined;

    // Keep shared answer key concept: answer lives at top-level only.
    return {
      id,
      type,
      answer,
      standard: {
        prompt: stdPrompt,
        options: stdOptions,
      },
      SUPPORTED: {
        prompt: supPrompt,
        options: supOptions,
        supports: supSupports,
      },
    } as ExerciseItem;
  });

  return {
    title,
    stage,
    schoolClass,
    cefrLevel,
    reading: {
      standard: readingStd.trim(),
      SUPPORTED: readingSup.trim(),
    },
    exercises: cleaned,
  };
}

// ---------------- Route ----------------

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const meta = (body as any).meta ?? {};
    const material = (body as any).material ?? {};
    const alignment = (body as any).alignment ?? {};

    const cefrLevel = parseCefrLevel(meta.cefrLevel ?? (body as any).cefrLevel ?? (body as any).level ?? "B1");

    const stage = Number.isFinite(Number(meta.stage ?? (body as any).stage))
      ? Number(meta.stage ?? (body as any).stage)
      : cefrToStageBand(cefrLevel);

    const schoolClass = Number.isFinite(Number(meta.schoolClass ?? (body as any).schoolClass))
      ? Number(meta.schoolClass ?? (body as any).schoolClass)
      : stage;

    const titleHint = String(meta.titleHint ?? (body as any).titleHint ?? "").trim();

    // Input material (text/url/html)
    const kind = String(material.kind ?? "text");
    const inputText =
      typeof material.text === "string"
        ? material.text
        : typeof (body as any).text === "string"
          ? (body as any).text
          : "";
    const inputUrl = typeof material.url === "string" ? material.url : "";
    const inputHtml = typeof material.html === "string" ? material.html : "";

    if (!inputText && !inputUrl && !inputHtml) {
      return NextResponse.json(
        { error: "Missing input text (material/text/url/html)." },
        { status: 400 }
      );
    }

    const allowLocalRefs = !!((body as any).allowLocalRefs ?? (body as any).allowLocalNames);
    const pilotMode = !!(body as any).pilotMode;

    const textType = String(alignment.textType ?? "Narrative");
    const purpose = Array.isArray(alignment.purpose) ? alignment.purpose.map(String) : [];
    const supports = Array.isArray(alignment.supports) ? alignment.supports.map(String) : [];
    const teacherNotes = String(alignment.notes ?? (body as any).notes ?? "").trim();

    const targets = stageTargets(stage);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY in env." }, { status: 500 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const client = new OpenAI({ apiKey });

    const systemPrompt = [
      "You are Aontas ESL Reading Pack Generator.",
      "Return ONLY valid JSON.",
      "Create TWO versions: standard and SUPPORTED.",
      "SUPPORTED must keep the same learning target and use the SAME ANSWERS (single shared answer key).",
      "SUPPORTED adds access supports (clearer wording, scaffolds, small hints, vocabulary supports), but does NOT oversimplify the target.",
      pilotMode
        ? "PILOT MODE is ON: include brief copyright-safe source notes only where appropriate; do not reproduce copyrighted text if the input looks copyrighted."
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const userPrompt = [
      `Target stage band: ${stage} (approx ${targets.words[0]}-${targets.words[1]} words).`,
      `School class: ${schoolClass}. CEFR: ${cefrLevel}.`,
      titleHint ? `Title hint: ${titleHint}` : "",
      `Text type: ${textType}.`,
      purpose.length ? `Purposes: ${purpose.join(", ")}` : "",
      supports.length ? `Requested supports: ${supports.join(", ")}` : "",
      teacherNotes ? `Teacher notes/context: ${teacherNotes}` : "",
      allowLocalRefs ? "Local names/places/cultural references are allowed (teacher judgment)." : "Avoid highly localised named references unless clearly supported by input.",
      "\nINPUT MATERIAL:",
      kind === "html" && inputHtml ? inputHtml : "",
      kind === "url" && inputUrl ? `URL: ${inputUrl}` : "",
      inputText ? inputText : "",
      "\nOUTPUT JSON SHAPE (must match):",
      "{",
      '  "title": string,',
      '  "stage": number (1-4),',
      '  "schoolClass": number,',
      '  "cefrLevel": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",',
      '  "reading": { "standard": string, "SUPPORTED": string },',
      '  "exercises": [',
      "    {",
      '      "id": string,',
      '      "type": "mcq"|"true_false"|"short_answer"|"matching"|"gap_fill"|"sequencing"|"vocab",',
      '      "answer": string | string[],',
      '      "standard": { "prompt": string, "options"?: string[] },',
      '      "SUPPORTED": { "prompt": string, "options"?: string[], "supports"?: string[] }',
      "    }",
      "  ]",
      "}",
      "\nRules:",
      "- Provide 8–10 exercises.",
      "- Use a single answer key: the top-level 'answer' applies to both versions.",
      "- For MCQ/True-False include options.",
      "- For matching: answer should be an array of pairs like ['A-1','B-3',...'].",
      "- For sequencing: answer should be an array in correct order.",
    ]
      .filter(Boolean)
      .join("\n");

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawText = completion.choices?.[0]?.message?.content ?? "";
    const jsonText = safeJsonExtract(rawText);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // One repair attempt: ask the model to output valid JSON only.
      const repair = await client.chat.completions.create({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return ONLY valid JSON. No markdown." },
          { role: "user", content: `Fix this into valid JSON matching the required shape.\n\n${rawText}` },
        ],
      });
      const repairedText = repair.choices?.[0]?.message?.content ?? "{}";
      parsed = JSON.parse(safeJsonExtract(repairedText));
    }

    const pack = validatePack(parsed);
    // Ensure stage + cefrLevel stay aligned with request, unless model omitted.
    pack.stage = stage;
    pack.schoolClass = schoolClass;
    pack.cefrLevel = cefrLevel;

    return NextResponse.json({ pack }, { status: 200 });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
