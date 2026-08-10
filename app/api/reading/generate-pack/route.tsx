import { NextResponse } from "next/server";
import { buildCefrConstraints, getWordTarget, parseCefrLevel, parseTextType } from "@/lib/cefr";
import { normalizeReadingPack } from "@/lib/contracts/reading";
import { fetchExternalText } from "@/lib/server/fetchExternalText";
import { checkRateLimit } from "@/lib/server/rateLimit";

// Ensure Node runtime (safer if you later add PDF/DOCX parsing server-side)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_DATA_URL_CHARS = 8_500_000;

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
  cefrLevel?: string;
  level?: string;
  textType?: string;
  /** Legacy-only inputs from older clients. */
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
  const upstream = await fetchExternalText(url, {
    maxBytes: 2 * 1024 * 1024,
    timeoutMs: 12_000,
    headers: {
      "User-Agent": "AontasESL/1.0 (+reading source fetch)",
      Accept: "text/html,text/plain;q=0.9,*/*;q=0.5",
    },
  });
  if (upstream.status < 200 || upstream.status >= 300) {
    throw new Error(`Failed to fetch URL (${upstream.status})`);
  }
  if (upstream.contentType.toLowerCase().includes("text/html")) return stripHtmlToText(upstream.text);
  return upstream.text.trim();
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
    cefrLevel: parseCefrLevel(stage),
    pilotMode,

    // Curriculum "hints"
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
        "schemaVersion",
        "title",
        "cefrLevel",
        "textType",
        "crest",
        "teacherContext",
        "materials",
        "primaryMaterialId",
        "reading",
        "exercises",
      ],
      properties: {
        schemaVersion: { type: "number", enum: [2] },
        title: { type: "string" },
        cefrLevel: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
        textType: { type: "string", enum: ["story", "short_message", "email_informal", "email_formal", "article", "review", "report", "essay"] },

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
          required: ["standard", "supported"],
          properties: {
            standard: { type: "string" },
            supported: { type: "string" },
          },
        },

        exercises: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "type", "skill", "answer", "answerIndex", "standard", "supported"],
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              skill: NullableString,

              answer: {
                anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
              },
              answerIndex: NullableNumber,

              standard: ExerciseSideSchema,
              supported: ExerciseSideSchema,
            },
          },
        },
      },
    },
  };
}

/* ---------------- Prompts ---------------- */

function buildSystemPrompt(body: GeneratePackBody) {
  const cefrLevel = parseCefrLevel(body.cefrLevel ?? body.level ?? body.stage ?? "B1");
  const textType = parseTextType(body.textType ?? body.genre ?? "article");
  const targets = getWordTarget(cefrLevel, textType);
  const tc = body.teacherContext;

  const guards = [
    "Teacher agency first: preserve teacher-provided names, places, organisations, terminology and facts.",
    "Do not invent facts that are not supported by the teacher-provided material.",
    "standard and supported must share one learning target and one answer key.",
    "supported is access support, not a different lesson: use clearer chunking, scaffolds, word banks and sentence frames without changing correct answers.",
    `STANDARD target length: about ${targets.target} words (acceptable range ${targets.min}-${targets.max}).`,
    "supported should cover the same core content and remain substantial; do not reduce it to a tiny summary.",
    "Return only valid JSON matching the schema. No commentary, markdown or code fences.",
  ];

  if (body.pilotMode) {
    guards.push(
      "Pilot mode: do not reproduce long copyrighted text verbatim unless it is clearly teacher-provided; prefer transformation, summary and original writing where appropriate."
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
    if (tc.localGlossary?.length) contextBits.push(`Local glossary:\n${tc.localGlossary.map((g) => `- ${g.term}: ${g.note}`).join("\n")}`);
  }

  const targetBits = [
    `CEFR level: ${cefrLevel}`,
    `Text type: ${textType}`,
    body.mode ? `Mode: ${body.mode}` : "",
    body.purpose ? `Purpose: ${body.purpose}` : "",
    body.form ? `Form: ${body.form}` : "",
    body.strand ? `Strand/context: ${body.strand}` : "",
    body.element ? `Element/context: ${body.element}` : "",
    body.outcomeLabel ? `Outcome/context: ${body.outcomeLabel}` : "",
  ].filter(Boolean);

  return [
    "You generate CEFR-aligned ESL reading packs for teachers and learners.",
    buildCefrConstraints(cefrLevel, textType),
    guards.map((g) => `- ${g}`).join("\n"),
    targetBits.length ? `\nTeacher target:\n${targetBits.map((p) => `- ${p}`).join("\n")}` : "",
    contextBits.length ? `\nTeacher context:\n${contextBits.map((c) => `- ${c}`).join("\n")}` : "",
    "\nOutput must match the provided JSON schema exactly.",
  ].filter(Boolean).join("\n");
}

function buildUserInstruction(body: GeneratePackBody, primaryTextHint: string) {
  const cefrLevel = parseCefrLevel(body.cefrLevel ?? body.level ?? body.stage ?? "B1");
  const textType = parseTextType(body.textType ?? body.genre ?? "article");
  const targets = getWordTarget(cefrLevel, textType);

  return [
    "Create an Aontas ESL reading pack.",
    `Title: ${body.title || "Reading Pack"}`,
    `CEFR: ${cefrLevel}`,
    `Text type: ${textType}`,
    `\nPrimary material:\n${primaryTextHint}`,
    "\nReading requirements:",
    `- Produce a coherent STANDARD ${textType} of roughly ${targets.target} words (acceptable range ${targets.min}-${targets.max}).`,
    "- Keep the source facts locked: do not add unsupported factual claims.",
    "- supported must cover the same content and learning target, using access supports rather than easier answers.",
    "- If the source is short, expand only with safe, generic connective language or clearly non-factual examples; do not invent source facts.",
    "\nExercises:",
    "- Create about 10-12 exercises.",
    "- standard and supported must use the same correct answers.",
    "- Use a mix of literal and inferential comprehension, vocabulary in context, sequencing/organisation, author craft and short response.",
  ].join("\n");
}

/* ---------------- OpenAI call ---------------- */

async function callOpenAIResponses(payload: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment.");

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

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
    console.error("Reading generation upstream error", res.status, errText.slice(0, 800));
    throw new Error(`Generation service returned an error (${res.status}).`);
  }

  return res.json();
}

/* ---------------- Route ---------------- */

export async function POST(req: Request) {
  const rate = checkRateLimit(req, { bucket: "reading-generate", limit: 15 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
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

    if (primaryText.length > 50_000) {
      return NextResponse.json({ error: "Source text is too large. Please shorten it before generating." }, { status: 413 });
    }

    const cefrLevel = parseCefrLevel(body.cefrLevel ?? body.level ?? body.stage ?? "B1");
    const textType = parseTextType(body.textType ?? body.genre ?? "article");

    if (primaryImageDataUrl) {
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(primaryImageDataUrl)) {
        return NextResponse.json({ error: "Unsupported image format. Use PNG, JPEG, WEBP or GIF." }, { status: 400 });
      }
      if (primaryImageDataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
        return NextResponse.json({ error: "Image is too large. Please use a smaller screenshot or photo." }, { status: 413 });
      }
    }

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
      // Helps reduce "creative formatting"
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

    const normalizedPack = normalizeReadingPack({
      ...pack,
      schemaVersion: 2,
      title: String(pack.title || body.title || "Reading Pack"),
      cefrLevel,
      textType,
      teacherContext: pack.teacherContext ?? body.teacherContext ?? undefined,
      materials: pack.materials ?? body.materials ?? undefined,
      primaryMaterialId: pack.primaryMaterialId ?? body.primaryMaterialId ?? undefined,
      pilotMode: body.pilotMode,
    });

    return NextResponse.json({ pack: normalizedPack });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

