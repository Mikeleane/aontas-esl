const fs = require("fs");
const path = require("path");

const target = path.join(process.cwd(), "app", "api", "reading", "generate-pack", "route.tsx");
if (!fs.existsSync(target)) {
  console.error("❌ Target not found:", target);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = target + `.bak_${stamp}`;
fs.copyFileSync(target, backup);
console.log("✅ Backup:", backup);

// IMPORTANT: This file is intentionally self-contained.
// No "@/app/_lib/cefr" imports. No duplicate stage vars. Uses Responses API text.format.
const ROUTE = `import { NextRequest, NextResponse } from "next/server";

/**
 * /api/reading/generate-pack
 * Returns: { pack: ... }
 *
 * Fixes:
 * - removes broken/duplicate stage/cefr vars
 * - removes "@/app/_lib/cefr" import (no module-not-found)
 * - uses Responses API "text.format" (json_schema) instead of legacy response_format
 */

type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

function parseCefrLevel(v: any): CefrLevel {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "A1" || s === "A2" || s === "B1" || s === "B2" || s === "C1" || s === "C2") return s;
  return "B1";
}

function cefrToStageBand(level: CefrLevel): number {
  // Keep it simple + stable: stage is a rough band for length/complexity.
  if (level === "A1") return 1;
  if (level === "A2") return 2;
  if (level === "B1") return 3;
  return 4; // B2/C1/C2
}

function stageTargets(stage: number) {
  if (stage <= 1) return { min: 120, max: 220 };
  if (stage === 2) return { min: 220, max: 360 };
  if (stage === 3) return { min: 360, max: 600 };
  return { min: 650, max: 950 }; // stage 4+
}

type Normalized = {
  titleHint: string;
  cefrLevel: CefrLevel;
  stage: number;
  schoolClass: number;

  allowLocalCulturalReferences: boolean;
  pilotMode: boolean;

  teacherNotes: string;

  primaryText: string;
  primaryImageDataUrl: string;

  model: string;
};

function normStr(v: any) {
  return String(v ?? "").trim();
}
function normBool(v: any) {
  return v === true || v === "true" || v === 1 || v === "1";
}
function normNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalize(body: any): Normalized {
  const meta = (body?.meta ?? {}) as any;
  const alignment = (body?.alignment ?? {}) as any;
  const material = (body?.material ?? {}) as any;

  const titleHint =
    normStr(meta?.titleHint) ||
    normStr(body?.titleHint) ||
    normStr(body?.title) ||
    "Reading Pack";

  const cefrLevel = parseCefrLevel(meta?.cefrLevel ?? body?.cefrLevel ?? body?.level ?? "B1");

  const stageRaw = normNum(meta?.stage ?? body?.stage);
  const stage = Number.isFinite(stageRaw) ? stageRaw : cefrToStageBand(cefrLevel);

  const classRaw = normNum(meta?.schoolClass ?? body?.schoolClass);
  const schoolClass = Number.isFinite(classRaw) ? classRaw : stage;

  const allowLocalCulturalReferences = normBool(
    body?.allowLocalCulturalReferences ??
    body?.allowLocalNames ??
    body?.allowLocal ??
    meta?.allowLocalCulturalReferences
  );

  const pilotMode = normBool(body?.pilotMode ?? meta?.pilotMode);

  const teacherNotes =
    normStr(alignment?.notes) ||
    normStr(meta?.notes) ||
    normStr(body?.teacherNotes) ||
    normStr(body?.notes) ||
    "";

  // Accept multiple legacy shapes:
  const primaryText =
    normStr(material?.text) ||
    normStr(body?.primaryText) ||
    normStr(body?.text) ||
    normStr(body?.inputText) ||
    "";

  const primaryImageDataUrl =
    normStr(material?.imageDataUrl) ||
    normStr(body?.primaryImageDataUrl) ||
    normStr(body?.imageDataUrl) ||
    "";

  const model =
    normStr(process.env.OPENAI_MODEL) ||
    normStr(process.env.OPENAI_READING_MODEL) ||
    "gpt-4o-mini";

  return {
    titleHint,
    cefrLevel,
    stage,
    schoolClass,
    allowLocalCulturalReferences,
    pilotMode,
    teacherNotes,
    primaryText,
    primaryImageDataUrl,
    model,
  };
}

/* ---------------- Schema ---------------- */

function buildPackJsonSchema(stage: number) {
  const targets = stageTargets(stage);

  // This schema is intentionally compatible with your UI expectation:
  // pack.reading.STANDARD + pack.reading.SUPPORTED plus exercises array.
  return {
    name: "reading_pack",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        meta: {
          type: "object",
          additionalProperties: true,
          properties: {
            cefrLevel: { type: "string" },
            stage: { type: "number" },
            schoolClass: { type: "number" },
            model: { type: "string" },
          },
        },
        reading: {
          type: "object",
          additionalProperties: false,
          properties: {
            STANDARD: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                vocab: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      term: { type: "string" },
                      definition: { type: "string" },
                      example: { type: "string" },
                    },
                    required: ["term", "definition"],
                  },
                },
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      prompt: { type: "string" },
                      answerKey: { type: "string" },
                    },
                    required: ["id", "prompt", "answerKey"],
                  },
                },
              },
              required: ["text", "questions"],
            },
            SUPPORTED: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                supports: {
                  type: "array",
                  items: { type: "string" },
                },
                vocab: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      term: { type: "string" },
                      definition: { type: "string" },
                      example: { type: "string" },
                    },
                    required: ["term", "definition"],
                  },
                },
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      prompt: { type: "string" },
                      answerKey: { type: "string" },
                    },
                    required: ["id", "prompt", "answerKey"],
                  },
                },
              },
              required: ["text", "questions"],
            },
          },
          required: ["STANDARD", "SUPPORTED"],
        },
        exercises: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              prompt: { type: "string" },
              items: { type: "array", items: {} },
              answerKey: {},
            },
            required: ["id", "type", "prompt"],
          },
        },
      },
      required: ["title", "reading"],
    },
    // Used only in prompt text (not in schema):
    _targets: targets,
  } as any;
}

/* ---------------- Prompts ---------------- */

function buildSystemPrompt(n: Normalized, targets: { min: number; max: number }) {
  const lines = [
    "You are an expert ESL teacher and curriculum designer.",
    "You produce a Reading Pack with two student variants:",
    "- STANDARD: mainstream version.",
    "- SUPPORTED: access-supported version for the same class.",
    "",
    "CRITICAL ALIGNMENT RULE:",
    "SUPPORTED must NOT be a tiny summary. Keep the same learning target and the SAME answer keys for questions.",
    "SUPPORTED can add access supports (clearer layout, simpler sentence structure, extra signposting, supports list),",
    "but questions must match by id and answerKey.",
    "",
    "Reading length target:",
    "Stage " + n.stage + " => about " + targets.min + "–" + targets.max + " words for STANDARD.",
    "SUPPORTED should be similar length (not drastically shorter), but clearer and more scaffolded.",
    "",
    "Return STRICT JSON ONLY that matches the provided JSON Schema.",
  ];

  if (n.pilotMode) {
    lines.push("", "PILOT MODE: keep content clean for internal classroom testing (no copyrighted passages).");
  }
  if (n.allowLocalCulturalReferences) {
    lines.push("", "Local references are allowed if teacher-appropriate and non-sensitive.");
  }

  return lines.join("\\n");
}

function buildUserPrompt(n: Normalized) {
  const chunks: string[] = [];

  chunks.push("Title hint: " + n.titleHint);
  chunks.push("CEFR: " + n.cefrLevel + " (stage band " + n.stage + "), class/year: " + n.schoolClass);
  if (n.teacherNotes) chunks.push("Teacher notes: " + n.teacherNotes);

  chunks.push("");
  chunks.push("Task:");
  chunks.push("1) Create pack.title based on the topic.");
  chunks.push("2) Create reading.STANDARD.text and reading.SUPPORTED.text.");
  chunks.push("3) Provide vocab list (8–12 items) with definitions (and examples if useful).");
  chunks.push("4) Provide questions arrays for both STANDARD and SUPPORTED with SAME ids + SAME answerKey (3–6 questions).");
  chunks.push("5) Optionally add an exercises array (2–4 items) if helpful.");

  if (n.primaryText) {
    chunks.push("");
    chunks.push("Source text:");
    chunks.push(n.primaryText);
  } else {
    chunks.push("");
    chunks.push("Source material is an image. Use it to create the reading text (do not mention the image).");
  }

  return chunks.join("\\n");
}

/* ---------------- OpenAI (Responses API) ---------------- */

async function callOpenAIResponses(args: {
  apiKey: string;
  model: string;
  instructions: string;
  input: any;
  schema: { name: string; strict: boolean; schema: any };
}) {
  // Responses API uses text.format (NOT response_format).  See OpenAI docs.
  const payload: any = {
    model: args.model,
    instructions: args.instructions,
    input: args.input,
    temperature: 0.2,
    text: {
      format: {
        type: "json_schema",
        name: args.schema.name,
        strict: args.schema.strict,
        schema: args.schema.schema,
      },
    },
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + args.apiKey,
    },
    body: JSON.stringify(payload),
  });

  const txt = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(txt);
  } catch {
    // keep raw
  }

  if (!res.ok) {
    const msg =
      (data && (data.error?.message || data.error)) ||
      txt ||
      ("OpenAI error (HTTP " + res.status + ")");
    throw new Error(String(msg));
  }

  return data ?? txt;
}

function extractResponsesText(data: any): string {
  // Most common: output_text at top-level, else walk output[] items.
  if (!data) return "";
  if (typeof data.output_text === "string") return data.output_text;

  const out = data.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === "output_text" && typeof c?.text === "string") return c.text;
        }
      }
    }
  }
  return "";
}

/* ---------------- Route ---------------- */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const n = normalize(body);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
    }

    if (!n.primaryText && !n.primaryImageDataUrl) {
      return NextResponse.json({ error: "Missing input text or imageDataUrl." }, { status: 400 });
    }

    const schemaAny = buildPackJsonSchema(n.stage) as any;
    const targets = schemaAny._targets ?? stageTargets(n.stage);

    const instructions = buildSystemPrompt(n, targets);
    const userPrompt = buildUserPrompt(n);

    const input =
      n.primaryImageDataUrl
        ? [
            {
              role: "user",
              content: [
                { type: "input_text", text: userPrompt },
                { type: "input_image", image_url: n.primaryImageDataUrl },
              ],
            },
          ]
        : userPrompt;

    const data = await callOpenAIResponses({
      apiKey,
      model: n.model,
      instructions,
      input,
      schema: { name: schemaAny.name, strict: schemaAny.strict, schema: schemaAny.schema },
    });

    const jsonText = extractResponsesText(data).trim();
    if (!jsonText) {
      return NextResponse.json(
        { error: "Model returned empty output_text." },
        { status: 500 }
      );
    }

    let pack: any;
    try {
      pack = JSON.parse(jsonText);
    } catch (e: any) {
      return NextResponse.json(
        { error: "Model output was not valid JSON.", detail: String(e?.message ?? e), snippet: jsonText.slice(0, 4000) },
        { status: 500 }
      );
    }

    // Ensure meta fields exist (helps UI)
    pack.meta = pack.meta ?? {};
    pack.meta.cefrLevel = pack.meta.cefrLevel ?? n.cefrLevel;
    pack.meta.stage = pack.meta.stage ?? n.stage;
    pack.meta.schoolClass = pack.meta.schoolClass ?? n.schoolClass;
    pack.meta.model = pack.meta.model ?? n.model;

    return NextResponse.json({ pack }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
`;

fs.writeFileSync(target, ROUTE, "utf8");
console.log("✅ Replaced:", target);
console.log("➡️  Now restart dev server: npm run dev");
