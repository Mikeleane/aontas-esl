import { NextResponse } from "next/server";
import { cefrStyleGuide, getWordTarget, parseCefrLevel } from "@/lib/cefr";
import {
  alignSocialVariants,
  normalizeSocialPack,
  validateSocialPack,
  type SocialMessage,
  type SocialPackData,
} from "@/lib/contracts/social";
import { checkRateLimit } from "@/lib/server/rateLimit";

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4.1-mini";
const MESSAGE_COUNT = 10;
const MIN_CONCEPTS = 8;

const FUN_ROSTER: ReadonlyArray<{ name: string; emoji: string }> = [
  { name: "Sofia", emoji: "🎨" },
  { name: "Mateo", emoji: "⚽" },
  { name: "Amina", emoji: "📚" },
  { name: "Luca", emoji: "🎧" },
  { name: "Mei", emoji: "🌟" },
  { name: "Daniel", emoji: "🧭" },
  { name: "Priya", emoji: "🪴" },
  { name: "Sam", emoji: "🛠️" },
  { name: "Noor", emoji: "✨" },
  { name: "Hana", emoji: "🌈" },
  { name: "Diego", emoji: "🎸" },
  { name: "Alex", emoji: "💡" },
];

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function jsonError(message: string, status = 500, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra ? { extra } : {}) }, { status });
}

async function callOpenAIChatCompletions(payload: UnknownRecord) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function isPlaceholderSpeaker(value: string): boolean {
  const text = value.trim();
  return !text || /^participant\s*\d+$/i.test(text) || /^speaker\s*\d+$/i.test(text);
}

function uniqStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function withAlignedRoster(pack: SocialPackData): SocialPackData {
  const standard = pack.standard.messages;
  const supported = pack.supported.messages;
  const count = Math.min(standard.length, supported.length);

  const standardMessages: SocialMessage[] = [];
  const supportedMessages: SocialMessage[] = [];

  for (let index = 0; index < count; index += 1) {
    const standardMessage = standard[index];
    const supportedMessage = supported[index];
    const fallback = FUN_ROSTER[index % FUN_ROSTER.length];
    const speaker = !isPlaceholderSpeaker(standardMessage.speaker)
      ? standardMessage.speaker
      : !isPlaceholderSpeaker(supportedMessage.speaker)
        ? supportedMessage.speaker
        : fallback.name;
    const emoji = standardMessage.emoji || supportedMessage.emoji || fallback.emoji;

    standardMessages.push({
      ...standardMessage,
      id: `m-${index + 1}`,
      speaker,
      emoji,
      tags: uniqStrings(standardMessage.tags),
    });
    supportedMessages.push({
      ...supportedMessage,
      id: `m-${index + 1}`,
      speaker,
      emoji,
      tags: uniqStrings(supportedMessage.tags),
    });
  }

  return {
    ...pack,
    standard: { messages: standardMessages },
    supported: { messages: supportedMessages },
  };
}

function pickChatStarter(inputText: string, variant: "standard" | "supported"): string {
  const text = inputText.toLowerCase();
  const aboutFeelings = /\b(feel|feeling|sad|low|upset|worried|anxious|stress|lonely|kind|kindness|friend)\b/.test(text);
  const aboutTradition = /\b(craft|tradition|heritage|community|festival|handmade|culture)\b/.test(text);
  const aboutConflict = /\b(argument|fight|bully|bullying|mean|rude|exclude|excluded|unkind)\b/.test(text);

  if (variant === "supported") {
    if (aboutFeelings) return "What can you say or do to help a friend who feels low? Give one example.";
    if (aboutConflict) return "If someone is being unkind, what is one safe and helpful thing to do?";
    if (aboutTradition) return "What tradition matters to you, and how could you share it with other people?";
    return "Which idea from this thread do you agree with? Give one reason.";
  }

  if (aboutFeelings) return "What is one kind, practical thing you could say or do to support someone who feels low, and why might it help?";
  if (aboutConflict) return "When someone is being unkind, what is a safe and respectful response, and why is it a good choice?";
  if (aboutTradition) return "What tradition from your family or community would you like to keep alive, and how could you share it respectfully?";
  return "Which message in this thread do you agree with most, and what example or evidence supports your view?";
}

function forceFinalStarter(pack: SocialPackData, inputText: string): SocialPackData {
  const variants = ["standard", "supported"] as const;
  const copy: SocialPackData = {
    ...pack,
    standard: { messages: pack.standard.messages.map((message) => ({ ...message })) },
    supported: { messages: pack.supported.messages.map((message) => ({ ...message })) },
  };

  for (const variant of variants) {
    const messages = copy[variant].messages;
    if (!messages.length) continue;
    const index = messages.length - 1;
    const message = messages[index];
    messages[index] = {
      ...message,
      text: pickChatStarter(inputText, variant),
      tags: uniqStrings([...message.tags, "discussion", "oral-language"]),
    };
  }

  return copy;
}

function normalizeConceptTerms(pack: SocialPackData): SocialPackData {
  return {
    ...pack,
    concepts: pack.concepts.map((concept, index) => ({
      ...concept,
      id: `concept-${index + 1}`,
      term: concept.term ? concept.term.slice(0, 1).toUpperCase() + concept.term.slice(1) : concept.term,
      definition: concept.definition.trim(),
      example: concept.example?.trim() || null,
    })),
  };
}

export async function POST(req: Request) {
  const rate = checkRateLimit(req, { bucket: "social-thread", limit: 20 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  if (!API_KEY) return jsonError("Missing OPENAI_API_KEY in environment.", 500);

  const rawBody = await req.text();
  let body: UnknownRecord;
  try {
    body = asRecord(rawBody ? JSON.parse(rawBody) : {});
  } catch {
    return jsonError("Request body was not valid JSON.", 400);
  }

  const text = String(body.text ?? "").trim();
  const cefrLevel = parseCefrLevel(body?.cefrLevel ?? body?.level ?? "B1");
  const tongueInCheek = Boolean(body.tongueInCheek);

  if (!text) return jsonError("Missing 'text' in JSON body.", 400);
  if (text.length > 50_000) return jsonError("Source text is too large. Please shorten it before generating.", 413);

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
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["id", "speaker", "text", "time", "emoji", "tags"],
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      subtitle: nullableString,
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
      checks: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            prompt: { type: "string" },
            answer: { type: "string" },
          },
          required: ["id", "prompt", "answer"],
        },
      },
      standard: {
        type: "object",
        additionalProperties: false,
        properties: {
          messages: {
            type: "array",
            minItems: MESSAGE_COUNT,
            maxItems: MESSAGE_COUNT,
            items: messageItem,
          },
        },
        required: ["messages"],
      },
      supported: {
        type: "object",
        additionalProperties: false,
        properties: {
          messages: {
            type: "array",
            minItems: MESSAGE_COUNT,
            maxItems: MESSAGE_COUNT,
            items: messageItem,
          },
        },
        required: ["messages"],
      },
    },
    required: ["title", "subtitle", "concepts", "checks", "standard", "supported"],
  };

  const shortMessageTarget = getWordTarget(cefrLevel, "short_message");
  const system = [
    `You generate a CEFR ${cefrLevel} Social Thread Pack for English language learning.`,
    cefrStyleGuide(cefrLevel),
    `Sentence-length guide: normally no more than about ${shortMessageTarget.maxSentenceWords} words per sentence.`,
    "Return strict JSON only, matching the provided JSON Schema.",
    "Standard and Supported must have the same learning target, message order, message IDs and speakers.",
    "Use IDs m-1 through m-10 in both variants, in exactly the same order.",
    "Supported is an access version: clearer language, shorter sentences and scaffolding, without reducing the core idea.",
    "Checks are shared by both variants and each check has one shared answer.",
    "Concepts are shared by both variants.",
    "Use natural human first names. Do not use labels such as Participant 1.",
    "Put emojis only in the emoji field, never in the speaker field.",
    `Produce exactly ${MESSAGE_COUNT} messages in each variant and at least ${MIN_CONCEPTS} concepts.`,
  ].join("\n");

  const styleNote = tongueInCheek
    ? "Tone: light, playful and slightly tongue-in-cheek, while remaining appropriate for an English-learning context."
    : "Tone: clear, natural, supportive and appropriate for an English-learning context.";

  const userPrompt = [
    `Create a CEFR ${cefrLevel} social-media-style message thread from the source text below.`,
    styleNote,
    "Keep factual claims grounded in the source text.",
    `Message ${MESSAGE_COUNT} must be an open discussion question that invites explanation, justification and response.`,
    "The Supported version must follow the same ten conversational moves as Standard.",
    "",
    "SOURCE TEXT:",
    text,
  ].join("\n");

  const payload: UnknownRecord = {
    model: MODEL,
    temperature: 0.7,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "social_thread_pack_v2",
        strict: true,
        schema,
      },
    },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  };

  const response = await callOpenAIChatCompletions(payload);
  const raw = await response.text();

  if (!response.ok) {
    console.error("OpenAI social-thread error:", response.status, raw);
    return jsonError(`Generation service returned an error (${response.status}).`, 502);
  }

  let envelope: UnknownRecord;
  try {
    envelope = asRecord(JSON.parse(raw));
  } catch {
    console.error("Social-thread upstream response was not JSON.");
    return jsonError("Generation service returned an invalid response.", 502);
  }

  const choices = Array.isArray(envelope.choices) ? envelope.choices : [];
  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice.message);
  const content = typeof message.content === "string" ? message.content : "";
  if (!content) return jsonError("Generation service returned no message content.", 502);

  let modelOutput: unknown;
  try {
    modelOutput = JSON.parse(content);
  } catch {
    console.error("Social-thread model content was not valid JSON.");
    return jsonError("Generated social thread was not valid structured data.", 502);
  }

  let pack = normalizeSocialPack(
    {
      ...asRecord(modelOutput),
      schemaVersion: 2,
      cefrLevel,
      textType: "short_message",
      meta: { model: MODEL, source: "teacher-input" },
    },
    { cefrLevel }
  );
  pack = alignSocialVariants(pack);
  pack = withAlignedRoster(pack);
  pack = normalizeConceptTerms(pack);
  pack = forceFinalStarter(pack, text);

  const errors = validateSocialPack(pack, { messageCount: MESSAGE_COUNT, minConcepts: MIN_CONCEPTS });
  if (errors.length) {
    console.error("Social-thread contract validation failed:", errors);
    return jsonError("Generated social thread failed the consistency check. Please try again.", 502, {
      code: "SOCIAL_CONTRACT_FAILED",
    });
  }

  return NextResponse.json({ pack }, { status: 200 });
}
