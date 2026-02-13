const fs = require("fs");
const path = require("path");

const TARGET = path.join(process.cwd(), "app/api/reading/generate-pack/route.tsx");

function backupFile(p) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = p + `.bak_${ts}`;
  fs.copyFileSync(p, bak);
  return bak;
}

function findOrThrow(s, needle) {
  const i = s.indexOf(needle);
  if (i === -1) throw new Error(`❌ Marker not found: ${needle}`);
  return i;
}

function replaceSection(s, startMarker, endMarker, replacement, label) {
  const a = findOrThrow(s, startMarker);
  const b = findOrThrow(s, endMarker);
  if (b <= a) throw new Error(`❌ Bad marker order for ${label}`);
  const out = s.slice(0, a) + replacement + s.slice(b);
  return out;
}

function replaceFromMarkerToEOF(s, startMarker, replacement, label) {
  const a = findOrThrow(s, startMarker);
  return s.slice(0, a) + replacement;
}

const PROMPTS_MARK = "/* ---------------- Prompts ---------------- */";
const ROUTE_MARK   = "/* ---------------- Route ---------------- */";

const PROMPTS_REPLACEMENT = `/* ---------------- Prompts ---------------- */

type GenCtx = {
  cefrLevel: string;
  stage: number;
  klass: number;
  targets: { min: number; max: number };
};

function computeCtx(body: any): GenCtx {
  const cefrLevel = parseCefrLevel(
    body?.meta?.cefrLevel ?? body?.cefrLevel ?? body?.level ?? "B1"
  );

  const stageRaw = body?.meta?.stage ?? body?.stage;
  const stage = Number.isFinite(Number(stageRaw))
    ? Number(stageRaw)
    : cefrToStageBand(cefrLevel);

  const klassRaw = body?.meta?.schoolClass ?? body?.schoolClass;
  const klass = Number.isFinite(Number(klassRaw)) ? Number(klassRaw) : stage;

  const targets = stageTargets(stage);
  return { cefrLevel, stage, klass, targets };
}

function buildSystemPrompt(body: any, ctx?: GenCtx) {
  const c = ctx ?? computeCtx(body);

  return [
    "You are Aontas ESL Reading Pack Generator.",
    "Create TWO aligned versions with the SAME learning target and SAME answer key:",
    "- STANDARD: normal level for the class.",
    "- SUPPORTED: same target and similar length, but with access supports (clearer layout, chunking, sentence starters, glossary, reduced extraneous load).",
    "",
    "IMPORTANT:",
    "- SUPPORTED must NOT be a tiny summary or oversimplified.",
    "- Keep content age-appropriate and classroom-safe.",
    "- Return STRICT JSON that matches the provided JSON Schema. No extra keys.",
    "",
    "Target CEFR: " + c.cefrLevel + ". Stage-band: " + c.stage + ". Class group: " + c.klass + ".",
    "Length target (Stage " + c.stage + "): about " + c.targets.min + "–" + c.targets.max + " words for STANDARD.",
    "SUPPORTED should be similar length (not a summary) but more accessible.",
  ].join("\\n");
}

function buildUserInstruction(body: any, primaryTextHint: string, ctx?: GenCtx) {
  const c = ctx ?? computeCtx(body);

  const titleHint = String(body?.meta?.titleHint ?? body?.title ?? "").trim();
  const textType = String(body?.alignment?.textType ?? "Article").trim();

  const supportsArr = Array.isArray(body?.alignment?.supports) ? body.alignment.supports : [];
  const purposeArr  = Array.isArray(body?.alignment?.purpose)  ? body.alignment.purpose  : [];

  const supports = supportsArr.length ? supportsArr.join(", ") : "None selected";
  const purpose  = purposeArr.length  ? purposeArr.join(", ")  : "None selected";

  const teacherNotes = String(body?.alignment?.notes ?? body?.teacherContext ?? "").trim();

  const allowLocalRefs = !!body?.meta?.allowLocalRefs;
  const pilotMode      = !!body?.meta?.pilotMode;

  return [
    "Build a reading pack from the PRIMARY material below.",
    "",
    titleHint ? ("Title hint: " + titleHint) : "No title hint provided.",
    "Text type: " + textType,
    "CEFR: " + c.cefrLevel + " (stage-band " + c.stage + "). Class: " + c.klass + ".",
    "Teacher purpose focus: " + purpose,
    "Supports requested: " + supports,
    teacherNotes ? ("Teacher notes: " + teacherNotes) : "Teacher notes: (none)",
    "Allow local references: " + (allowLocalRefs ? "YES" : "NO"),
    "Pilot mode (copyright warning on teacher materials only): " + (pilotMode ? "YES" : "NO"),
    "",
    "PRIMARY MATERIAL (text extract or placeholder if image-only):",
    primaryTextHint,
    "",
    "Output requirements:",
    "- Produce the full JSON pack matching schema.",
    "- Ensure Standard and Supported share one answer key alignment.",
    "- Include glossary/key words, sentence starters, and reduced extraneous load supports when requested.",
  ].join("\\n");
}

`;

const ROUTE_REPLACEMENT = `/* ---------------- Route ---------------- */

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const body = normalizeTeacherRequest(raw);

    const ctx = computeCtx(body);

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

    if (!primaryText && !primaryImageDataUrl) {
      return NextResponse.json(
        {
          error: "No primary text or image provided. Add text, a link, or a screenshot/image.",
          debug: {
            hasPrimaryText: !!primaryText,
            hasPrimaryImage: !!primaryImageDataUrl,
            hasPrimaryUrl: !!body.primaryUrl,
            materialsCount: Array.isArray(body.materials) ? body.materials.length : 0,
          },
        },
        { status: 400 }
      );
    }

    const system = buildSystemPrompt(body, ctx);

    const primaryTextHint = primaryText
      ? primaryText.slice(0, 12_000)
      : "(Primary text will be inferred from the image.)";

    const userInstruction = buildUserInstruction(body, primaryTextHint, ctx);

    // Multimodal user content: include image if present (data URL supported)
    const userContent: Array<any> = [{ type: "input_text", text: userInstruction }];

    if (primaryImageDataUrl) {
      userContent.push({
        type: "input_image",
        image_url: primaryImageDataUrl,
      });
    }

    const schema = buildJsonSchema();

    // IMPORTANT: Responses API uses text.format (NOT response_format).  :contentReference[oaicite:1]{index=1}
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
      temperature: 0.4,
    });

    const outText = extractResponsesText(response);

    if (!outText || !outText.trim()) {
      return NextResponse.json(
        { error: "Model returned no output text (unexpected)." },
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
            debug: { outputPreview: outText.slice(0, 800) },
          },
          { status: 500 }
        );
      }
      pack = JSON.parse(candidate);
    }

    // Normalize defaults and echo helpful fields
    pack.title = String(pack.title || body.title || "Reading Pack");
    pack.stage = Number(pack.stage ?? ctx.stage);
    pack.schoolClass = Number(pack.schoolClass ?? ctx.klass);

    pack.meta = {
      ...(pack.meta ?? {}),
      cefrLevel: String(pack?.meta?.cefrLevel ?? ctx.cefrLevel),
      stageBand: Number(pack?.meta?.stageBand ?? ctx.stage),
      model: String(pack?.meta?.model ?? process.env.OPENAI_MODEL ?? ""),
    };

    // carry through teacher context / materials if present (handy for later exports)
    pack.teacherContext = pack.teacherContext ?? body.teacherContext ?? null;
    pack.materials = pack.materials ?? (body.materials ?? null);
    pack.primaryMaterialId = pack.primaryMaterialId ?? (body.primaryMaterialId ?? null);

    // Frontend expects { pack: ... }
    return NextResponse.json({ pack });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

`;

if (!fs.existsSync(TARGET)) {
  console.error("❌ Target not found:", TARGET);
  process.exit(1);
}

let s = fs.readFileSync(TARGET, "utf8");
const bak = backupFile(TARGET);
console.log("✅ Backup:", bak);

const promptsStart = s.indexOf(PROMPTS_MARK);
const routeStart = s.indexOf(ROUTE_MARK);

if (promptsStart === -1 || routeStart === -1 || routeStart <= promptsStart) {
  console.error("❌ Could not find expected markers or marker order is wrong.");
  console.error("   Need both markers:", PROMPTS_MARK, "and", ROUTE_MARK);
  process.exit(1);
}

// Replace everything from PROMPTS marker up to ROUTE marker
s = replaceSection(s, PROMPTS_MARK, ROUTE_MARK, PROMPTS_REPLACEMENT + ROUTE_MARK, "PROMPTS->ROUTE");
// Now replace ROUTE marker to EOF
s = replaceFromMarkerToEOF(s, ROUTE_MARK, ROUTE_REPLACEMENT, "ROUTE->EOF");

fs.writeFileSync(TARGET, s, "utf8");
console.log("✅ Patched:", TARGET);
