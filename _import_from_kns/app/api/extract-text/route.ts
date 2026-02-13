import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type ExtractBody = {
  imageDataUrl?: string;
  fromPublishedMaterial?: boolean;
  pilotOk?: boolean;
};

type ExtractResult = {
  title?: string;
  text?: string;
};

function cleanText(s: string) {
  return (s || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET() {
  return NextResponse.json(
    { ok: true, route: "extract-text", method: "GET" },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  try {
    let body: ExtractBody;
    try {
      body = (await req.json()) as ExtractBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const imageDataUrl = (body?.imageDataUrl || "").toString();
    if (!imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Missing or invalid imageDataUrl (expected a data:image/* URL)." },
        { status: 400 }
      );
    }

    const fromPublishedMaterial = !!body?.fromPublishedMaterial;
    const pilotOk = !!body?.pilotOk;
    if (fromPublishedMaterial && !pilotOk) {
      return NextResponse.json(
        { error: "Pilot-use acknowledgement required for published material." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured on the server, so image extraction is unavailable.",
        },
        { status: 500 }
      );
    }

    const modelName =
      process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const client = new OpenAI({ apiKey });

    const userPrompt = `Extract the main readable text from the image.

Rules:
- Return ONLY JSON.
- Do not add facts. Do not paraphrase. Copy the text as faithfully as possible.
- Preserve paragraph breaks where obvious.
- If there are multiple blocks/columns, output in a sensible reading order.

Return JSON ONLY with this shape:
{
  "title": "(optional, best guess)",
  "text": "(the extracted text)"
}`;

    const completion = await client.chat.completions.create({
      model: modelName,
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract text from classroom materials images. Be literal and avoid hallucinations.",
        },
        {
          role: "user",
          // The OpenAI SDK types for multimodal content can lag; cast to any.
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ] as any,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() || "";
    let parsed: ExtractResult | null = null;
    try {
      parsed = JSON.parse(content) as ExtractResult;
    } catch {
      parsed = null;
    }

    const title = cleanText((parsed?.title || "").toString());
    const textOut = cleanText((parsed?.text || "").toString());

    if (!textOut) {
      return NextResponse.json(
        { error: "Could not extract text from that image. Try a clearer photo." },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        title: title || null,
        text: textOut,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("/api/extract-text error", err);
    return NextResponse.json(
      { error: err?.message || "Unexpected error while extracting text." },
      { status: 500 }
    );
  }
}
