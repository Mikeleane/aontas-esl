import { NextResponse } from "next/server";

// Ensure this route runs on the Node.js runtime (needed for fetch + OpenAI calls).
export const runtime = "nodejs";

type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

function parseCefrLevel(v: unknown, fallback: CefrLevel = "B1"): CefrLevel {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "A1" || s === "A2" || s === "B1" || s === "B2" || s === "C1" || s === "C2") return s;
  return fallback;
}

function cefrToStageBand(level: CefrLevel): number {
  // Aontas ESL uses 4-ish difficulty bands. Map CEFR to that.
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

type NormalizedMaterial =
  | { kind: "text"; text: string }
  | { kind: "html"; html: string }
  | { kind: "url"; url: string }
  | { kind: "image"; imageDataUrl: string };

type NormalizedInput = {
  stage: number;
  schoolClass: number;
  cefrLevel: CefrLevel;
  titleHint: string;
  teacherNotes: string;
  allowLocalNames: boolean;
  pilotMode: boolean;
  material: NormalizedMaterial;
};

function safeInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickMaterial(body: any): NormalizedMaterial | null {
  // New format (Aontas ESL)
  const m = body?.material ?? body?.meta?.material;
  if (m && typeof m === "object") {
    const kind = String(m.kind ?? "").toLowerCase();
    if (kind === "text" && typeof m.text === "string" && m.text.trim()) return { kind: "text", text: m.text };
    if (kind === "html" && typeof m.html === "string" && m.html.trim()) return { kind: "html", html: m.html };
    if (kind === "url" && typeof m.url === "string" && m.url.trim()) return { kind: "url", url: m.url };
    if (
      (kind === "image" || kind === "img") &&
      typeof (m.imageDataUrl ?? m.dataUrl) === "string" &&
      String(m.imageDataUrl ?? m.dataUrl).trim()
    ) {
      return { kind: "image", imageDataUrl: String(m.imageDataUrl ?? m.dataUrl) };
    }
  }

  // Legacy format (KNS)
  if (typeof body?.primaryText === "string" && body.primaryText.trim()) return { kind: "text", text: body.primaryText };
  if (typeof body?.primaryHtml === "string" && body.primaryHtml.trim()) return { kind: "html", html: body.primaryHtml };
  if (typeof body?.primaryUrl === "string" && body.primaryUrl.trim()) return { kind: "url", url: body.primaryUrl };
  if (typeof body?.primaryImageDataUrl === "string" && body.primaryImageDataUrl.trim()) {
    return { kind: "image", imageDataUrl: body.primaryImageDataUrl };
  }

  // Extra fallbacks (older experiments)
  if (typeof body?.inputText === "string" && body.inputText.trim()) return { kind: "text", text: body.inputText };

  return null;
}

async function fetchUrlText(url: string): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Aontas/reading-pack",
        accept: "text/html, text/plain;q=0.9, */*;q=0.5",
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch URL (HTTP ${res.status}).`);
    const text = await res.text();
    // Guardrail: don\'t send megabytes to the model.
    return text.length > 120_000 ? text.slice(0, 120_000) : text;
  } finally {
    clearTimeout(t);
  }
}

function buildSystemPrompt(n: NormalizedInput): string {
  const lines: string[] = [
    "You generate an Aontas Reading Pack as STRICT JSON matching the provided JSON Schema.",
    "Two versions must share ONE answer key: Standard and SUPPORTED must target the same learning goals.",
    "SUPPORTED must not be oversimplified; provide access supports (clearer instructions, scaffolds, chunking, extra spacing cues) while keeping the same correct answers.",
    `Target difficulty band (stage): ${n.stage}. School class: ${n.schoolClass}. CEFR hint: ${n.cefrLevel}.`,
    n.allowLocalNames ? "Local names/places/cultural references are allowed (teacher judgement)." : "Avoid local/private names unless necessary.",
    n.pilotMode
      ? "PILOT MODE: Do not reproduce copyrighted text verbatim if the input looks copyrighted; summarise/transform and keep any source notes brief."
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function buildUserInstruction(n: NormalizedInput, inputText: string): string {
  const titleHint = (n.titleHint || "").trim();
  const notes = (n.teacherNotes || "").trim();

  return [
    titleHint ? `Title hint: ${titleHint}` : "",
    notes ? `Teacher notes: ${notes}` : "",
    "\nCreate a reading pack with:",
    "- reading.standard: the standard version of the reading text.",
    "- reading.SUPPORTED: same meaning and learning target, but with supports (shorter sentences, clearer structure, optional glossary cues inside the text, careful formatting cues).",
    "- 10 exercises in 'exercises' using a mix of: comprehension, vocabulary-in-context, grammar-in-context, and short writing/speaking prompts.",
    "- Each exercise MUST include 'standard' and 'SUPPORTED' prompts, and MUST share the same correct answer.",
    "- Keep answers short and unambiguous.",
    "\nINPUT MATERIAL:\n" + inputText,
  ]
    .filter(Boolean)
    .join("\n");
}

// This schema mirrors app/_features/reading/readingPackTypes.ts (KNS/Aontas baseline)
const READING_PACK_SCHEMA: any = {
  type: "object",
  additionalProperties: false,
  required: ["title", "schoolClass", "stage", "reading", "exercises"],
  properties: {
    title: { type: "string" },
    schoolClass: { type: "integer" },
    stage: { type: "integer" },
    pilotMode: { type: "boolean" },
    crest: { type: "string" },
    reading: {
      type: "object",
      additionalProperties: false,
      required: ["standard", "SUPPORTED"],
      properties: {
        standard: { type: "string" },
        SUPPORTED: { type: "string" },
      },
    },
    exercises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "answer", "standard", "SUPPORTED"],
        properties: {
          id: { anyOf: [{ type: "integer" }, { type: "string" }] },
          type: { type: "string" },
          skill: { type: "string" },
          answer: { type: "string" },
          answerIndex: { type: "integer" },
          standard: {
            type: "object",
            additionalProperties: false,
            required: ["prompt"],
            properties: {
              prompt: { type: "string" },
              items: { type: "array", items: { type: "string" } },
              options: { type: "array", items: { type: "string" } },
            },
          },
          SUPPORTED: {
            type: "object",
            additionalProperties: false,
            required: ["prompt"],
            properties: {
              prompt: { type: "string" },
              items: { type: "array", items: { type: "string" } },
              options: { type: "array", items: { type: "string" } },
            },
          },
          adapted: {
            type: "object",
            additionalProperties: false,
            required: ["prompt"],
            properties: {
              prompt: { type: "string" },
              items: { type: "array", items: { type: "string" } },
              options: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

function buildTextFormatJsonSchema() {
  return {
    // NOTE: name is REQUIRED by the Responses API for json_schema.
    // (This is exactly the error you were seeing: missing text.format.name.)
    type: "json_schema",
    name: "reading_pack",
    strict: true,
    schema: READING_PACK_SCHEMA,
  };
}

function extractOutputText(json: any): string {
  const output = json?.output;
  if (!Array.isArray(output)) return "";
  for (const item of output) {
    if (item?.type === "message" && item?.role === "assistant" && Array.isArray(item?.content)) {
      const t = item.content.find((c: any) => c?.type === "output_text" && typeof c?.text === "string");
      if (t?.text) return t.text;
    }
  }
  return "";
}

function safeJsonParse(s: string): any {
  const trimmed = (s || "").trim();
  if (!trimmed) throw new Error("Empty model response.");
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try to salvage if there is leading/trailing text
    const a = trimmed.indexOf("{");
    const b = trimmed.lastIndexOf("}");
    if (a >= 0 && b > a) {
      const sub = trimmed.slice(a, b + 1);
      return JSON.parse(sub);
    }
    throw new Error("Model returned invalid JSON.");
  }
}

async function callOpenAIResponses(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  imageDataUrl?: string;
}): Promise<any> {
  const { apiKey, model, systemPrompt, userPrompt, imageDataUrl } = params;

  const userContent: any[] = [{ type: "input_text", text: userPrompt }];
  if (imageDataUrl) {
    userContent.push({
      type: "input_image",
      image_url: imageDataUrl,
      detail: "high",
    });
  }

  const body = {
    model,
    // Put the system prompt in `instructions`.
    instructions: systemPrompt,
    input: [{ role: "user", content: userContent }],
    temperature: 0.4,
    max_output_tokens: 2500,
    text: {
      format: buildTextFormatJsonSchema(),
    },
  };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await res.text();
    if (!res.ok) {
      // Surface OpenAI errors as-is; they\'re useful in the UI.
      throw new Error(raw || `OpenAI error (HTTP ${res.status}).`);
    }

    const json = JSON.parse(raw);
    const outText = extractOutputText(json);
    const pack = safeJsonParse(outText);
    return pack;
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(() => ({}));

    const meta = body?.meta && typeof body.meta === "object" ? body.meta : {};

    const cefrLevel = parseCefrLevel(meta?.cefrLevel ?? body?.cefrLevel ?? body?.level ?? "B1", "B1");
    const inferredStage = cefrToStageBand(cefrLevel);

    const stage = safeInt(meta?.stage ?? body?.stage, inferredStage);
    const schoolClass = safeInt(meta?.schoolClass ?? body?.schoolClass, stage);

    const material = pickMaterial(body);
    if (!material) {
      return NextResponse.json(
        { error: "Missing input text (material/text/url/html/image)." },
        { status: 400 }
      );
    }

    const titleHint = String(meta?.titleHint ?? body?.titleHint ?? body?.title ?? "");
    const teacherNotes = String(body?.teacherNotes ?? body?.teacherContext ?? body?.notes ?? "");
    const allowLocalNames = !!(body?.allowLocalNames ?? body?.allowLocal ?? body?.allowLocalContext);
    const pilotMode = !!(body?.pilotMode ?? body?.pilot);

    const normalized: NormalizedInput = {
      stage,
      schoolClass,
      cefrLevel,
      titleHint,
      teacherNotes,
      allowLocalNames,
      pilotMode,
      material,
    };

    let inputText = "";
    let imageDataUrl: string | undefined;

    if (material.kind === "text") inputText = material.text;
    else if (material.kind === "html") inputText = material.html;
    else if (material.kind === "url") inputText = await fetchUrlText(material.url);
    else if (material.kind === "image") {
      inputText = "Use the provided image as the source material.";
      imageDataUrl = material.imageDataUrl;
    }

    if (!inputText || !inputText.trim()) {
      return NextResponse.json(
        { error: "Missing input text (material/text/url/html/image)." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in environment." },
        { status: 500 }
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1";

    const systemPrompt = buildSystemPrompt(normalized);
    const userPrompt = buildUserInstruction(normalized, inputText);

    const pack = await callOpenAIResponses({
      apiKey,
      model,
      systemPrompt,
      userPrompt,
      imageDataUrl,
    });

    // Force required fields that the frontend depends on.
    // (If the model omitted them, we fail loudly instead of crashing later.)
    if (!pack || typeof pack !== "object") throw new Error("Model returned empty pack.");
    if (!pack.reading || typeof pack.reading !== "object") throw new Error("Pack missing reading.");
    if (typeof pack.reading.standard !== "string" || typeof pack.reading.SUPPORTED !== "string") {
      throw new Error("Pack reading.standard or reading.SUPPORTED missing.");
    }
    if (!Array.isArray(pack.exercises)) throw new Error("Pack missing exercises array.");

    // Inject metadata (keeps things consistent even if the model drifts).
    pack.stage = stage;
    pack.schoolClass = schoolClass;
    pack.pilotMode = pilotMode;

    return NextResponse.json({ pack });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
