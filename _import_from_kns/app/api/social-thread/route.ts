// app/api/social-thread/route.ts
import { NextResponse } from "next/server";

const API_KEY = process.env.OPENAI_API_KEY;

// Hard requirements for your school version:
const MESSAGE_COUNT = 10; // exactly 10 messages per variant
const MIN_CONCEPTS = 8;   // at least 8 vocab pills

// Fun roster (kept emoji OUT of the speaker name — we store it in message.emoji)
const FUN_ROSTER: Array<{ name: string; emoji: string }> = [
  { name: "Biddy O’Sullivan", emoji: "🧺" },
  { name: "Timmy O’Shea", emoji: "🗣️" },
  { name: "Aoife Ní Shúilleabháin", emoji: "🧶" },
  { name: "Cian O’Connor", emoji: "🦊" },
  { name: "Niamh Fitzgerald", emoji: "🌈" },
  { name: "Oisín Murphy", emoji: "🧭" },
  { name: "Róisín Walsh", emoji: "🎨" },
  { name: "Darragh Keane", emoji: "⚽" },
  { name: "Saoirse Flynn", emoji: "📚" },
  { name: "Tadhg O’Brien", emoji: "🎻" },
  { name: "Eabha Ryan", emoji: "✨" },
  { name: "Fionn Byrne", emoji: "🛠️" },
];

function jsonError(message: string, status = 500, extra?: any) {
  return NextResponse.json({ error: message, ...(extra ? { extra } : {}) }, { status });
}

async function callOpenAIChatCompletions(payload: any) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function safeId(s: string) {
  return (s || "id")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

function capitalize(s: string) {
  s = String(s || "");
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

function isPlaceholderSpeaker(s: any) {
  const t = String(s ?? "").trim();
  // Participant 1 / Participant1 / participant 2 etc.
  return /^participant\s*\d+$/i.test(t) || /^participant\d+$/i.test(t);
}

function uniqStrings(arr: any[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr || []) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function pickChatStarter(inputText: string, variant: "standard" | "supported") {
  const t = String(inputText || "").toLowerCase();

  const aboutFeelings =
    /\b(feel|feeling|sad|low|down|upset|worried|anxious|stress|stressed|lonely|cheer|cheering|kind|kindness|friend)\b/.test(t);

  const aboutCraftTradition =
    /\b(workshop|craft|weav|straw|hat|making|tradition|heritage|community|festival|handmade)\b/.test(t);

  const aboutConflict =
    /\b(argument|fight|bully|bullying|mean|rude|exclude|excluded)\b/.test(t);

  if (variant === "supported") {
    if (aboutFeelings) {
      return "Class chat: What can you say or do to help a friend who feels low? Give one example.";
    }
    if (aboutConflict) {
      return "Class chat: If someone is being unkind, what is a safe, helpful thing to do? Say one idea.";
    }
    if (aboutCraftTradition) {
      return "Class chat: What tradition do you like in your family or community? How can we share it in school?";
    }
    return "Class chat: What is one idea from this thread you agree with? Why?";
  }

  // Standard (slightly richer language)
  if (aboutFeelings) {
    return "Class chat-starter: What’s one kind, practical thing you could say or do to support someone who feels low, and why would it help?";
  }
  if (aboutConflict) {
    return "Class chat-starter: When someone is being unkind, what is a safe and respectful response (for you, for a friend, or for the class)? Explain your reasoning.";
  }
  if (aboutCraftTradition) {
    return "Class chat-starter: What tradition from your family or community would you like to keep alive, and how could we share it respectfully in school?";
  }
  return "Class chat-starter: Which message in this thread do you agree with most, and what evidence or example can you give to explain your opinion?";
}

function applyRoster(pack: any) {
  const map = new Map<string, { name: string; emoji: string }>();
  let rosterIdx = 0;

  const rosterByName = new Map<string, string>(FUN_ROSTER.map(r => [r.name, r.emoji]));

  function splitLeadingEmoji(s: string) {
    const t = String(s || "").trim();
    const parts = t.split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0];
      const rest = parts.slice(1).join(" ");
      // Treat a short, non-alphanumeric token as an emoji marker (e.g., "🦊 Aoife")
      if (first.length <= 4 && /^[^A-Za-z0-9]+$/.test(first)) {
        return { emoji: first, name: rest };
      }
    }
    return null;
  }

  // Collect in a stable order: Standard first, then Supported
  const allMessages: any[] = []
    .concat(pack?.standard?.messages || [])
    .concat(pack?.supported?.messages || []);

  for (const m of allMessages) {
    const sp0 = String(m?.speaker ?? "").trim();
    const lead0 = splitLeadingEmoji(sp0);
    const sp = lead0 ? lead0.name : sp0;
    if (!isPlaceholderSpeaker(sp)) continue;
    if (!map.has(sp)) {
      map.set(sp, FUN_ROSTER[rosterIdx % FUN_ROSTER.length]);
      rosterIdx += 1;
    }
  }

  function fixMessages(msgs: any[]) {
    return (msgs || []).map((m: any, i: number) => {
      const sp0 = String(m?.speaker ?? "").trim();
    const lead0 = splitLeadingEmoji(sp0);
    const sp = lead0 ? lead0.name : sp0;
      const mapped = isPlaceholderSpeaker(sp) ? map.get(sp) : null;

      const speaker = mapped ? mapped.name : (sp || "Someone");
      const emoji = (m?.emoji != null && String(m.emoji).trim() !== "")
        ? String(m.emoji)
        : (mapped ? mapped.emoji : null);

      return {
        id: String(m?.id ?? `m-${i + 1}`),
        speaker,
        text: String(m?.text ?? "").trim(),
        time: m?.time == null ? null : String(m.time),
        emoji,
        tags: uniqStrings(Array.isArray(m?.tags) ? m.tags : []),
      };
    });
  }

  pack.standard.messages = fixMessages(pack?.standard?.messages);
  pack.supported.messages = fixMessages(pack?.supported?.messages);
  return pack;
}

function forceFinalStarter(pack: any, inputText: string) {
  for (const v of ["standard", "supported"] as const) {
    const msgs = Array.isArray(pack?.[v]?.messages) ? pack[v].messages : [];
    if (!msgs.length) continue;

    const starter = pickChatStarter(inputText, v);
    const lastIdx = msgs.length - 1;
    const last = msgs[lastIdx] || {};
    const tags = uniqStrings([...(last.tags || []), "discussion", "oral-language", "curriculum"]);

    msgs[lastIdx] = {
      ...last,
      text: starter,
      tags,
    };
    pack[v].messages = msgs;
  }
  return pack;
}

export async function POST(req: Request) {
  if (!API_KEY) return jsonError("Missing OPENAI_API_KEY in environment.", 500);

  const rawBody = await req.text();
  let body: any = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return jsonError("Request body was not valid JSON.", 400, { rawBodyPreview: rawBody.slice(0, 200) });
  }

  const text = (body?.text ?? "").toString().trim();
  const tongueInCheek = !!body?.tongueInCheek;

  if (!text) return jsonError("Missing 'text' in JSON body.", 400);

  // JSON Schema that OpenAI accepts: additionalProperties:false + required includes all properties keys.
  const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

  const messageItem = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      speaker: { type: "string" },
      text: { type: "string" },
      time: nullableString,
      emoji: nullableString,
      tags: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["id", "speaker", "text", "time", "emoji", "tags"],
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      subtitle: nullableString,

      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          model: { type: "string" },
          source: { type: "string" },
        },
        required: ["model", "source"],
      },

      // Force at least 8 concept pills
      concepts: {
        type: "array",
        minItems: MIN_CONCEPTS,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            term: { type: "string" },
            definition: { type: "string" },
            example: nullableString,
          },
          required: ["id", "term", "definition", "example"],
        },
      },

      standard: {
        type: "object",
        additionalProperties: false,
        properties: {
          // Force exactly 10 messages
          messages: {
            type: "array",
            minItems: MESSAGE_COUNT,
            maxItems: MESSAGE_COUNT,
            items: messageItem,
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
        required: ["messages", "checks"],
      },

      supported: {
        type: "object",
        additionalProperties: false,
        properties: {
          // Force exactly 10 messages
          messages: {
            type: "array",
            minItems: MESSAGE_COUNT,
            maxItems: MESSAGE_COUNT,
            items: messageItem,
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
        required: ["messages", "checks"],
      },
    },
    required: ["title", "subtitle", "meta", "concepts", "standard", "supported"],
  };

  const system = [
    "You generate a Social Thread Pack for language learning.",
    "Return STRICT JSON only, matching the provided JSON Schema.",
    "No markdown. No extra keys.",
    "Standard and Supported must stay aligned to the same learning target and shared check answers.",
    "",
    "Use fun, human speaker names (avoid 'Participant 1' etc).",
    "If you include emojis, put them in the message.emoji field (NOT in speaker names).",
    "The final message (#10) must be a class discussion-starter question aligned to oral language goals (explain, justify, listen, respond).",
    "",
    `Hard requirements:`,
    `- EXACTLY ${MESSAGE_COUNT} messages in Standard, and EXACTLY ${MESSAGE_COUNT} messages in Supported.`,
    `- At least ${MIN_CONCEPTS} vocabulary concepts (term+definition+example).`,
  ].join("\n");

  const styleNote = tongueInCheek
    ? "Tone: light, playful, slightly tongue-in-cheek, but school-appropriate."
    : "Tone: clear, school-appropriate, supportive.";

  const userPrompt = [
    "Create a short social-media-style message thread based on the input text.",
    styleNote,
    "",
    "Constraints:",
    `1) Produce exactly ${MESSAGE_COUNT} messages per variant.`,
    `2) Include at least ${MIN_CONCEPTS} vocabulary concepts. Concepts must be useful, age-appropriate, and appear naturally in the messages.`,
    "3) Keep Supported as access support (clearer language / shorter sentences / scaffolds) without changing the learning target.",
    `4) Make message #${MESSAGE_COUNT} a class discussion-starter question (ends with '?') that encourages pupils to explain their opinion and listen/respond.`,
    "",
    "INPUT TEXT:",
    text,
  ].join("\n");

  const payload = {
    model: "gpt-4.1-mini",
    temperature: 0.7,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "social_thread_pack",
        strict: true,
        schema,
      },
    },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  };

  const res = await callOpenAIChatCompletions(payload);
  const raw = await res.text();

  if (!res.ok) {
    console.error("OpenAI error:", res.status, raw);
    return jsonError(`OpenAI error ${res.status}: ${raw}`, res.status);
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("Failed to JSON.parse OpenAI response:", raw);
    return jsonError("OpenAI response was not JSON.", 500, { rawPreview: raw.slice(0, 400) });
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("Missing message.content in OpenAI response:", data);
    return jsonError("OpenAI returned no message content.", 500);
  }

  let pack: any;
  try {
    pack = JSON.parse(content);
  } catch {
    console.error("Model content was not valid JSON:", content);
    return jsonError("Model output was not valid JSON.", 500, { contentPreview: String(content).slice(0, 400) });
  }

  // Normalize concept IDs + terms (helps pill lookup stay consistent)
  pack.concepts = (pack.concepts || []).map((c: any, i: number) => ({
    ...c,
    id: c?.id ? String(c.id) : `c-${i + 1}-${safeId(c?.term || "term")}`,
    term: capitalize(String(c?.term || "").trim()),
    definition: String(c?.definition || "").trim(),
    example: c?.example == null ? null : String(c.example).trim(),
  }));

  // Post-process: fun names + emoji fields + guaranteed final discussion starter
  pack = applyRoster(pack);
  pack = forceFinalStarter(pack, text);

  return NextResponse.json({ pack }, { status: 200 });
}
