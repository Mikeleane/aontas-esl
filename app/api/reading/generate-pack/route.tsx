import { NextResponse } from "next/server";
import { parseCefrLevel, cefrToStageBand } from "../../../../lib/cefr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GlossItem = {
  term: string;
  definition: string;
  example: string;
};

type CheckItem = {
  id: string;
  prompt: string;
  answerKey: string;
};

type ReadingPack = {
  title: string;
  subtitle?: string;
  meta: {
    model: string;
    source: string;
    cefrLevel: string;
    stage: number;
    schoolClass: number;
    createdAt: string;
  };
  texts: {
    standard: string;
    supported: string;
  };
  glossary: GlossItem[];
  checks: CheckItem[]; // shared answer key for class
};

function stageTargets(stage: number) {
  if (stage <= 1) return { min: 120, max: 220 };
  if (stage === 2) return { min: 220, max: 360 };
  if (stage === 3) return { min: 360, max: 600 };
  return { min: 650, max: 950 };
}

function toInt(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function cleanText(x: any): string {
  return String(x ?? "").replace(/\r\n/g, "\n").trim();
}

async function fetchUrlText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText}`);
    const ct = res.headers.get("content-type") || "";
    const raw = await res.text();
    // very light HTML stripping if needed
    if (ct.includes("text/html") || /<html[\s>]/i.test(raw)) {
      return raw
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return raw.trim();
  } finally {
    clearTimeout(t);
  }
}

async function getPrimaryText(body: any): Promise<{ text: string; source: string }> {
  // Preferred shape: { material: { kind, text/html/url/imageDataUrl } }
  const mat = body?.material ?? body?.materials?.[0] ?? null;

  // Most common: direct text paste
  const direct =
    mat?.text ??
    body?.text ??
    body?.inputText ??
    body?.materialText ??
    null;

  if (direct && String(direct).trim()) {
    return { text: cleanText(direct), source: "user_text" };
  }

  // URL input
  const url =
    mat?.url ??
    body?.url ??
    body?.inputUrl ??
    null;

  if (url && String(url).trim()) {
    const u = String(url).trim();
    const txt = await fetchUrlText(u);
    return { text: cleanText(txt), source: u };
  }

  // HTML paste
  const html = mat?.html ?? body?.html ?? null;
  if (html && String(html).trim()) {
    const stripped = String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { text: cleanText(stripped), source: "user_html" };
  }

  return { text: "", source: "unknown" };
}

function extractOutputText(resp: any): string {
  // SDKs sometimes provide output_text; raw API returns output[].content[].type=output_text
  if (typeof resp?.output_text === "string") return resp.output_text;

  const out = resp?.output;
  if (!Array.isArray(out)) return "";
  let s = "";
  for (const item of out) {
    if (item?.type === "message" && Array.isArray(item?.content)) {
      for (const c of item.content) {
        if (c?.type === "output_text" && typeof c?.text === "string") {
          s += c.text;
        }
      }
    }
  }
  return s.trim();
}

function safeJsonParse(text: string): any {
  const t = String(text || "").trim();
  if (!t) throw new Error("Model returned empty text.");

  try {
    return JSON.parse(t);
  } catch {
    // try to salvage first JSON object
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Model output was not valid JSON.");
  }
}

async function callResponsesJson(args: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schema: any;
}): Promise<any> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: args.system }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: args.user }],
        },
      ],
      // Responses API structured outputs uses text.format :contentReference[oaicite:1]{index=1}
      text: {
        format: {
          type: "json_schema",
          name: "ReadingPack",
          strict: true,
          schema: args.schema,
        },
      },
      temperature: 0.4,
      max_output_tokens: 2200,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json);
    throw new Error(msg);
  }

  const outText = extractOutputText(json);
  return safeJsonParse(outText);
}

const PACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    texts: {
      type: "object",
      additionalProperties: false,
      properties: {
        standard: { type: "string" },
        supported: { type: "string" },
      },
      required: ["standard", "supported"],
    },
    glossary: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          term: { type: "string" },
          definition: { type: "string" },
          example: { type: "string" },
        },
        required: ["term", "definition", "example"],
      },
    },
    checks: {
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
  required: ["title", "texts", "glossary", "checks"],
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const cefrLevel = parseCefrLevel(
      body?.meta?.cefrLevel ?? body?.cefrLevel ?? body?.level ?? "B1"
    );

    const stage =
      toInt(body?.meta?.stage ?? body?.stage) ??
      cefrToStageBand(cefrLevel);

    const schoolClass =
      toInt(body?.meta?.schoolClass ?? body?.schoolClass) ??
      stage;

    const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
    }

    const primary = await getPrimaryText(body);
    const inputText = primary.text;
    if (!inputText) {
      return NextResponse.json({ error: "Missing input text (material/text/url/html)." }, { status: 400 });
    }

    const targets = stageTargets(stage);

    const system =
      "You generate an ESL reading pack. Return JSON ONLY (no markdown, no extra keys). " +
      "Standard and Supported must target the SAME CEFR level and the SAME learning goal. " +
      "Supported adds access supports (clearer structure, shorter sentences, more signposting), NOT an easier level. " +
      "The checks must share ONE answer key usable by the whole class.";

    const user =
      "CEFR: " + String(cefrLevel) + "\n" +
      "Stage band: " + String(stage) + " | Class: " + String(schoolClass) + "\n" +
      "Length target for STANDARD: about " + String(targets.min) + "–" + String(targets.max) + " words. " +
      "SUPPORTED should be similar length (not a tiny summary) but with access supports.\n\n" +
      "Create:\n" +
      "1) title + optional subtitle\n" +
      "2) texts.standard (article)\n" +
      "3) texts.supported (same CEFR, more scaffolding)\n" +
      "4) glossary: 10–14 useful terms from the text (term, definition, example)\n" +
      "5) checks: 6–10 comprehension/meaning questions with answerKey (shared)\n\n" +
      "INPUT MATERIAL:\n" + inputText;

    const rawPack = await callResponsesJson({
      apiKey,
      model,
      system,
      user,
      schema: PACK_SCHEMA,
    });

    const now = new Date().toISOString();

    const pack: ReadingPack = {
      title: cleanText(rawPack?.title) || "Reading Pack",
      subtitle: cleanText(rawPack?.subtitle || ""),
      meta: {
        model,
        source: String(primary.source || "user_text"),
        cefrLevel: String(cefrLevel),
        stage,
        schoolClass,
        createdAt: now,
      },
      texts: {
        standard: cleanText(rawPack?.texts?.standard),
        supported: cleanText(rawPack?.texts?.supported),
      },
      glossary: Array.isArray(rawPack?.glossary) ? rawPack.glossary : [],
      checks: Array.isArray(rawPack?.checks) ? rawPack.checks : [],
    };

    // Safety: ensure we always return something useful
    if (!pack.texts.standard || !pack.texts.supported) {
      return NextResponse.json(
        { error: "Model returned incomplete pack (missing texts).", raw: rawPack },
        { status: 500 }
      );
    }

    return NextResponse.json({ pack });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
