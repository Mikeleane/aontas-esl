import { NextResponse } from "next/server";

// Ensure Node runtime (safer if you later add PDF/DOCX parsing server-side)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- Types ---------------- */

type MaterialType = "link" | "text" | "image" | "pdf" | "docx" | "other";

type Material = {
  id: string;
  type: MaterialType;
  title: string;

  url?: string;
  rawText?: string;

  fileName?: string;
  mimeType?: string;
  fileDataUrl?: string;

  extractedText?: string;
  extractionStatus?: "none" | "processing" | "done" | "needs_review" | "failed";

  useAsPrimaryText?: boolean;
};

type TeacherContext = {
  contextTags: string[];
  crossCurricularLinks: string[];
  authenticMaterialTypes: string[];
  localVocab: string;
  localGlossary: Array<{ term: string; note: string }>;
  useLocalContextExactly: boolean;
  onlyUseProvidedFacts: boolean;
};

type GeneratePackBody = {
  title?: string;
  stage?: number;
  schoolClass?: number;

  // Primary input convenience
  primaryText?: string;
  primaryUrl?: string;
  primaryImageDataUrl?: string; // data:image/... base64

  // Teacher-led workflow
  materials?: Material[];
  primaryMaterialId?: string;
  teacherContext?: TeacherContext;

  // Curriculum / text type (optional)
  strand?: string;
  element?: string;
  outcomeLabel?: string;
  mode?: string; // Print/Audio/Video/Image-led/Mixed
  purpose?: string; // recount/explain/etc
  genre?: string;
  form?: string;

  // Generation knobs
  exerciseBlocks?: string[];
  pilotMode?: boolean;
};

/**
 * The current /app/page.tsx sends TeacherRequest:
 * { meta: {...}, alignment: {...}, material: {...} }
 */
type InputKind = "link" | "text" | "paste" | "upload";
type MaterialInput =
  | { kind: "link"; url: string }
  | { kind: "text"; text: string }
  | { kind: "upload"; filename: string; mime: string; dataUrl: string }
  | { kind: "paste"; mime: string; dataUrl: string };

type TeacherRequest = {
  meta?: {
    schoolClass?: number;
    stage?: number;
    titleHint?: string;
    allowLocalNames?: boolean;
    pilotMode?: boolean;
  };
  alignment?: {
    textType?: string;
    purpose?: string[];
    supports?: string[];
    notes?: string;
  };
  material?: MaterialInput;
};

/* ---------------- Helpers ---------------- */

function stripHtmlToText(html: string) {
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|br|h1|h2|h3|h4|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim() || ""
  );
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);
  const raw = await res.text();
  if (ct.includes("text/html")) return stripHtmlToText(raw);
  return raw.trim();
}

function pickPrimaryMaterial(body: GeneratePackBody): Material | null {
  const mats = body.materials || [];
  if (!mats.length) return null;

  if (body.primaryMaterialId) return mats.find((m) => m.id === body.primaryMaterialId) || null;

  const flagged = mats.find((m) => m.useAsPrimaryText);
  return flagged || mats[0] || null;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function stageTargets(stage: number) {
  // You can tweak these later; this is a solid “not too short” baseline.
  if (stage <= 1) return { min: 120, max: 220 };
  if (stage === 2) return { min: 220, max: 360 };
  if (stage === 3) return { min: 360, max: 600 };
  return { min: 650, max: 950 }; // stage 4
}

/**
 * Responses API output extraction:
 * - response.output_text sometimes exists
 * - otherwise, you must walk response.output[].content[].text
 */
function extractResponsesText(resp: any): string {
  const t = typeof resp?.output_text === "string" ? resp.output_text : "";
  if (t && t.trim()) return t;

  const out = resp?.output;
  if (Array.isArray(out)) {
    const chunks: string[] = [];
    for (const item of out) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (typeof c?.text === "string" && c.text.trim()) chunks.push(c.text);
        // Some variants use output_text keys per content item
        if (typeof c?.output_text === "string" && c.output_text.trim()) chunks.push(c.output_text);
      }
    }
    const joined = chunks.join("\n").trim();
    if (joined) return joined;
  }

  // last resort
  return "";
}

/**
 * Balanced-brace JSON object extraction (safer than regex).
 * Finds the first complete {...} object, skipping braces inside strings.
 */
function findFirstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (ch === '"') {
      // skip string contents with escapes
      i++;
      for (; i < s.length; i++) {
        if (s[i] === "\\") i++; // skip escaped char
        else if (s[i] === '"') break;
      }
      continue;
    }

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function normalizeTeacherRequest(body: any): GeneratePackBody {
  // If it already looks like GeneratePackBody, keep it.
  if (body && (body.primaryText || body.primaryImageDataUrl || body.materials || body.primaryUrl)) {
    return body as GeneratePackBody;
  }

  // Otherwise treat it as TeacherRequest (page.tsx format)
  const tr = body as TeacherRequest;

  const stage = clamp(Number(tr?.meta?.stage ?? 3), 1, 4);
  const schoolClass = clamp(Number(tr?.meta?.schoolClass ?? 3), 1, 6);

  const title = (tr?.meta?.titleHint || "").trim() || "Reading Pack";
  const pilotMode = !!tr?.meta?.pilotMode;

  // Light teacher context from alignment (kept permissive)
  const teacherContext: TeacherContext = {
    contextTags: [],
    crossCurricularLinks: [],
    authenticMaterialTypes: [],
    localVocab: (tr?.alignment?.notes || "").trim(),
    localGlossary: [],
    useLocalContextExactly: true,
    onlyUseProvidedFacts: true,
  };

  const textType = tr?.alignment?.textType || "";
  const purpose = Array.isArray(tr?.alignment?.purpose) ? tr?.alignment?.purpose.join(", ") : "";
  const supports = Array.isArray(tr?.alignment?.supports) ? tr?.alignment?.supports.join(", ") : "";

  // Map their material into our canonical fields
  const mat = tr?.material;
  let primaryText = "";
  let primaryUrl = "";
  let primaryImageDataUrl = "";

  if (mat?.kind === "text") {
    primaryText = String(mat.text || "").trim();
  } else if (mat?.kind === "link") {
    primaryUrl = String(mat.url || "").trim();
  } else if (mat?.kind === "paste") {
    // paste tab is image-only
    primaryImageDataUrl = String(mat.dataUrl || "").trim();
  } else if (mat?.kind === "upload") {
    const mime = String(mat.mime || "");
    const dataUrl = String(mat.dataUrl || "").trim();
    if (mime.startsWith("image/")) primaryImageDataUrl = dataUrl;
    else {
      // PDF/DOCX parsing not implemented here yet
      // Force teacher to paste text or screenshot for MVP stability.
      primaryText = "";
      primaryUrl = "";
      primaryImageDataUrl = "";
    }
  }

  return {
    title,
    stage,
    schoolClass,
    pilotMode,

    // Curriculum “hints”
    genre: textType || undefined,
    purpose: [purpose, supports].filter(Boolean).join(" • ") || undefined,

    teacherContext,

    primaryText: primaryText || undefined,
    primaryUrl: primaryUrl || undefined,
    primaryImageDataUrl: primaryImageDataUrl || undefined,
  };
}

/* ---------------- JSON Schema (OpenAI strict rules) ---------------- */
/**
 * IMPORTANT:
 * OpenAI strict json_schema currently requires:
 * - if additionalProperties:false and you have properties,
 *   required MUST include EVERY key in properties.
 * So we make optional fields nullable instead of omitting them.
 */
function buildJsonSchema() {
  const NullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
  const NullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };
  const NullableBool = { anyOf: [{ type: "boolean" }, { type: "null" }] };

  const TeacherContextSchema = {
    type: "object",
    additionalProperties: false,
    required: [
      "contextTags",
      "crossCurricularLinks",
      "authenticMaterialTypes",
      "localVocab",
      "localGlossary",
      "useLocalContextExactly",
      "onlyUseProvidedFacts",
    ],
    properties: {
      contextTags: { type: "array", items: { type: "string" } },
      crossCurricularLinks: { type: "array", items: { type: "string" } },
      authenticMaterialTypes: { type: "array", items: { type: "string" } },
      localVocab: { type: "string" },
      localGlossary: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["term", "note"],
          properties: {
            term: { type: "string" },
            note: { type: "string" },
          },
        },
      },
      useLocalContextExactly: { type: "boolean" },
      onlyUseProvidedFacts: { type: "boolean" },
    },
  };

  const MaterialSchema = {
    type: "object",
    additionalProperties: false,
    // strict-mode rule: required must include EVERY key in properties
    required: [
      "id",
      "type",
      "title",
      "url",
      "rawText",
      "fileName",
      "mimeType",
      "fileDataUrl",
      "extractedText",
      "extractionStatus",
      "useAsPrimaryText",
    ],
    properties: {
      id: { type: "string" },
      type: { type: "string" },
      title: { type: "string" },

      url: NullableString,
      rawText: NullableString,

      fileName: NullableString,
      mimeType: NullableString,
      fileDataUrl: NullableString,

      extractedText: NullableString,
      extractionStatus: NullableString, // could tighten to enum later
      useAsPrimaryText: NullableBool,
    },
  };

  const ExerciseSideSchema = {
    type: "object",
    additionalProperties: false,
    required: ["prompt", "options"],
    properties: {
      prompt: { type: "string" },
      options: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
    },
  };

  return {
    name: "reading_pack",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "schoolClass",
        "stage",
        "crest",
        "teacherContext",
        "materials",
        "primaryMaterialId",
        "reading",
        "exercises",
      ],
      properties: {
        title: { type: "string" },
        schoolClass: { type: "number" },
        stage: { type: "number" },

        crest: NullableString,

        teacherContext: { anyOf: [TeacherContextSchema, { type: "null" }] },

        materials: {
          anyOf: [
            { type: "array", items: MaterialSchema },
            { type: "null" },
          ],
        },

        primaryMaterialId: NullableString,

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
            required: ["id", "type", "skill", "answer", "answerIndex", "standard", "SUPPORTED", "adapted"],
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              skill: NullableString,

              answer: {
                anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
              },
              answerIndex: NullableNumber,

              standard: ExerciseSideSchema,
              SUPPORTED: { anyOf: [ExerciseSideSchema, { type: "null" }] },
              adapted: { anyOf: [ExerciseSideSchema, { type: "null" }] },
            },
          },
        },
      },
    },
  };
}

/* ---------------- Prompts ---------------- */

function buildSystemPrompt(body: GeneratePackBody) {
  const stage = body.stage ?? 3;
  const klass = body.schoolClass ?? 3;
  const targets = stageTargets(stage);

  const tc = body.teacherContext;

  const guards = [
    "Teacher agency first: do not replace local placenames or organisations.",
    "Do not invent local facts. If something is not provided, omit it or keep it generic.",
    "STANDARD and SUPPORTED must share ONE answer key (same correct answers).",
    "SUPPORTED is not 'easier content'—it is access supports: chunking, clearer layout, word banks, sentence frames, etc.",
    "Keep learning target the same for the whole class.",
    `Reading length target (Stage ${stage}): about ${targets.min}–${targets.max} words for STANDARD. SUPPORTED should be similar length (not a tiny summary) but with access supports.`,
    "Return ONLY valid JSON matching the schema. No commentary, no markdown, no code fences.",
  ];

  if (body.pilotMode) {
    guards.push(
      "Pilot mode: do not reproduce long copyrighted text verbatim unless it is clearly teacher-provided; prefer paraphrase, summary, and original writing inspired by the material."
    );
  }

  const contextBits: string[] = [];
  if (tc) {
    contextBits.push(
      `Use local context exactly as entered: ${tc.useLocalContextExactly ? "YES" : "NO"}.`,
      `Only use facts provided by teacher: ${tc.onlyUseProvidedFacts ? "YES" : "NO"}.`
    );
    if (tc.contextTags?.length) contextBits.push(`Context tags: ${tc.contextTags.join(", ")}`);
    if (tc.crossCurricularLinks?.length) contextBits.push(`Cross-curricular: ${tc.crossCurricularLinks.join(", ")}`);
    if (tc.authenticMaterialTypes?.length) contextBits.push(`Authentic material types: ${tc.authenticMaterialTypes.join(", ")}`);
    if (tc.localVocab?.trim()) contextBits.push(`Teacher notes / local vocab:\n${tc.localVocab.trim()}`);
    if (tc.localGlossary?.length)
      contextBits.push(`Local glossary:\n${tc.localGlossary.map((g) => `- ${g.term}: ${g.note}`).join("\n")}`);
  }

  const plcBits: string[] = [];
  if (body.strand) plcBits.push(`Strand: ${body.strand}`);
  if (body.element) plcBits.push(`Element: ${body.element}`);
  if (body.outcomeLabel) plcBits.push(`Outcome label: ${body.outcomeLabel}`);
  if (body.mode) plcBits.push(`Mode: ${body.mode}`);
  if (body.purpose) plcBits.push(`Purpose: ${body.purpose}`);
  if (body.genre) plcBits.push(`Genre/Text type: ${body.genre}`);
  if (body.form) plcBits.push(`Form: ${body.form}`);

  return [
    `You generate Irish primary school reading packs.`,
    `Stage: ${stage}. Class: ${klass}.`,
    guards.map((g) => `- ${g}`).join("\n"),
    plcBits.length ? `\nCurriculum target:\n${plcBits.map((p) => `- ${p}`).join("\n")}` : "",
    contextBits.length ? `\nTeacher context:\n${contextBits.map((c) => `- ${c}`).join("\n")}` : "",
    `\nOutput MUST match the provided JSON schema exactly.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserInstruction(body: GeneratePackBody, primaryTextHint: string) {
  const stage = body.stage ?? 3;
  const targets = stageTargets(stage);

  return [
    `Create a reading pack.`,
    `Title: ${body.title || "Reading Pack"}`,
    `Stage: ${stage}`,
    `Class: ${body.schoolClass ?? 3}`,

    `\nPrimary material:\n${primaryTextHint}`,

    `\nReading requirements:`,
    `- Write/produce a coherent STANDARD reading text that is roughly ${targets.min}–${targets.max} words (not a short snippet).`,
    `- SUPPORTED should cover the same content and be similar length, but with access supports (chunking, clearer sentences, occasional word bank/glossary cues).`,
    `- If the provided excerpt is short, expand with original writing on the same theme rather than staying tiny.`,

    `\nExercises:`,
    `- Make ~10–12 exercises.`,
    `- Ensure the answer key is shared between STANDARD and SUPPORTED.`,
    `- Use a mix: literal + inferential, vocab in context, sequencing, author craft, short response.`,
  ].join("\n");
}

/* ---------------- OpenAI call ---------------- */

async function callOpenAIResponses(payload: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment.");

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, ...payload }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 800)}`);
  }

  return res.json();
}

/* ---------------- Route ---------------- */

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const body = normalizeTeacherRequest(rawBody);

    // Determine primary material / primary input
    const primaryMat = pickPrimaryMaterial(body);

    let primaryText = String(body.primaryText || "").trim();
    let primaryImageDataUrl = String(body.primaryImageDataUrl || "").trim();

    if (!primaryText && primaryMat) {
      const matText = String(primaryMat.extractedText || primaryMat.rawText || "").trim();
      if (matText) primaryText = matText;

      if (!primaryImageDataUrl && primaryMat.type === "image" && primaryMat.fileDataUrl) {
        primaryImageDataUrl = primaryMat.fileDataUrl;
      }
    }

    // URL fallback
    if (!primaryText && body.primaryUrl) {
      primaryText = await fetchUrlText(body.primaryUrl);
    } else if (!primaryText && primaryMat?.type === "link" && primaryMat.url) {
      primaryText = await fetchUrlText(primaryMat.url);
    }

    const stage = body.stage ?? 3;
    const schoolClass = body.schoolClass ?? 3;

    if (!primaryText && !primaryImageDataUrl) {
      return NextResponse.json(
        {
          error: "No primary text or image provided. Add text, a link, or a screenshot/image.",
          debug: {
            hasPrimaryText: !!primaryText,
            hasPrimaryImage: !!primaryImageDataUrl,
            hasPrimaryUrl: !!body.primaryUrl,
            materialsCount: Array.isArray(body.materials) ? body.materials.length : 0,
            hint: "Ensure your client sends material.text OR material.url OR material.dataUrl (data:image/...)",
          },
        },
        { status: 400 }
      );
    }

    const system = buildSystemPrompt(body);

    const primaryTextHint = primaryText
      ? primaryText.slice(0, 12_000) // safety cap
      : "(Primary text will be inferred from the image.)";

    const userInstruction = buildUserInstruction(body, primaryTextHint);

    // Multimodal user content: include image if present (data URL supported)
    const userContent: Array<any> = [{ type: "input_text", text: userInstruction }];

    if (primaryImageDataUrl) {
      userContent.push({
        type: "input_image",
        image_url: primaryImageDataUrl,
      });
    }

    const schema = buildJsonSchema();

    const response = await callOpenAIResponses({
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          ...schema,
        },
      },
      max_output_tokens: 3600,
      // Helps reduce “creative formatting”
      temperature: 0.4,
    });

    const outText = extractResponsesText(response);

    if (!outText || !outText.trim()) {
      return NextResponse.json(
        {
          error: "Model returned no output text (unexpected).",
          debug: {
            hint: "This usually means you read the wrong field from the Responses API, or the model refused.",
          },
        },
        { status: 500 }
      );
    }

    let pack: any;
    try {
      pack = JSON.parse(outText);
    } catch {
      const candidate = findFirstJsonObject(outText);
      if (!candidate) {
        return NextResponse.json(
          {
            error: "Model output was not valid JSON.",
            debug: {
              outputPreview: outText.slice(0, 800),
              hint: "The model returned text that didn't contain a full JSON object.",
            },
          },
          { status: 500 }
        );
      }
      try {
        pack = JSON.parse(candidate);
      } catch {
        return NextResponse.json(
          {
            error: "Model output contained JSON-like text but could not be parsed.",
            debug: {
              jsonPreview: candidate.slice(0, 800),
            },
          },
          { status: 500 }
        );
      }
    }

    // Normalize defaults and echo helpful fields
    pack.title = String(pack.title || body.title || "Reading Pack");
    pack.stage = Number(pack.stage ?? stage);
    pack.schoolClass = Number(pack.schoolClass ?? schoolClass);

    // carry through teacher context / materials if present (handy for later exports)
    pack.teacherContext = pack.teacherContext ?? body.teacherContext ?? null;
    pack.materials = pack.materials ?? (body.materials ?? null);
    pack.primaryMaterialId = pack.primaryMaterialId ?? (body.primaryMaterialId ?? null);

    // Compatibility: return both pack + spread
    return NextResponse.json({ ...pack, pack });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
