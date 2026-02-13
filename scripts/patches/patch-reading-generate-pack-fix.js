const fs = require("fs");

const file = "app/api/reading/generate-pack/route.tsx";
let s = fs.readFileSync(file, "utf8");

// remove BOM anywhere
s = s.replace(/\uFEFF/g, "");

// --- Replace buildSystemPrompt() ---
s = s.replace(
  /function buildSystemPrompt\([\s\S]*?\n}\n\nfunction buildUserInstruction/,
`function buildSystemPrompt(body) {
  const stage = Number.isFinite(Number(body?.stage)) ? Number(body.stage) : 3;
  const klass = Number.isFinite(Number(body?.schoolClass)) ? Number(body.schoolClass) : stage;
  const targets = stageTargets(stage);

  return [
    "You generate inclusive ESL reading packs with TWO variants: STANDARD and SUPPORTED.",
    "SUPPORTED = access supports, but same learning target and similar length.",
    "",
    "Reading length target (Stage " + stage + "): about " + targets.min + "–" + targets.max + " words (STANDARD).",
    "Class: " + klass + ".",
  ].join("\\n");
}

function buildUserInstruction`
);

// --- Replace buildUserInstruction() ---
s = s.replace(
  /function buildUserInstruction\([\s\S]*?\n}\n\n\/\* ---------------- Route ---------------- \*\//,
`function buildUserInstruction(body, primaryTextHint) {
  const stage = Number.isFinite(Number(body?.stage)) ? Number(body.stage) : 3;
  const klass = Number.isFinite(Number(body?.schoolClass)) ? Number(body.schoolClass) : stage;
  const targets = stageTargets(stage);

  return [
    "Make a reading pack from the material below.",
    "",
    "Context:",
    "- Stage: " + stage + " (target: ~" + targets.min + "–" + targets.max + " words)",
    "- Class: " + klass,
    "- Text type: " + (body?.textType ?? "Article"),
    "",
    "Deliverables (STANDARD and SUPPORTED):",
    "- reading text",
    "- vocabulary",
    "- comprehension checks + answer key",
    "- final discussion prompt",
    "",
    "INPUT (hint/preview):",
    primaryTextHint,
  ].join("\\n");
}

/* ---------------- Route ---------------- */`
);

// --- Clean the CEFR/stage duplication inside POST() ---
s = s.replace(
  /export async function POST\(req: Request\)[\s\S]*$/,
`export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const body = normalizeTeacherRequest(rawBody);

    // Always compute locally (never rely on globals)
    const stage = Number.isFinite(Number(body?.stage)) ? Number(body.stage) : 3;
    const schoolClass = Number.isFinite(Number(body?.schoolClass)) ? Number(body.schoolClass) : stage;

    let primaryText = String(body.primaryText || "").trim();
    let primaryImageDataUrl = String(body.primaryImageDataUrl || "").trim();

    const primaryMat = pickPrimaryMaterial(body);
    if (!primaryText && primaryMat) {
      const matText = String(primaryMat.extractedText || primaryMat.rawText || "").trim();
      if (matText) primaryText = matText;
      if (!primaryImageDataUrl && primaryMat.type === "image" && primaryMat.fileDataUrl) {
        primaryImageDataUrl = primaryMat.fileDataUrl;
      }
    }

    if (!primaryText && body.primaryUrl) {
      primaryText = await fetchUrlText(body.primaryUrl);
    }

    if (!primaryText && !primaryImageDataUrl) {
      return NextResponse.json(
        { error: "No primary text or image provided." },
        { status: 400 }
      );
    }

    const system = buildSystemPrompt({ ...body, stage, schoolClass });
    const primaryTextHint = primaryText
      ? primaryText.slice(0, 12000)
      : "(Text inferred from image.)";

    const userInstruction = buildUserInstruction({ ...body, stage, schoolClass }, primaryTextHint);

    const userContent = [{ type: "input_text", text: userInstruction }];
    if (primaryImageDataUrl) {
      userContent.push({ type: "input_image", image_url: primaryImageDataUrl });
    }

    const schema = buildJsonSchema();

    const response = await callOpenAIResponses({
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: userContent },
      ],
      text: { format: { type: "json_schema", ...schema } },
      max_output_tokens: 3600,
      temperature: 0.4,
    });

    const outText = extractResponsesText(response);
    if (!outText || !outText.trim()) {
      return NextResponse.json({ error: "Empty model response." }, { status: 500 });
    }

    let pack;
    try {
      pack = JSON.parse(outText);
    } catch {
      const candidate = findFirstJsonObject(outText);
      if (!candidate) {
        return NextResponse.json({ error: "Model output not valid JSON." }, { status: 500 });
      }
      pack = JSON.parse(candidate);
    }

    return NextResponse.json({ pack });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
`
);

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched:", file);
