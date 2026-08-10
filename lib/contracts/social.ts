import { parseCefrLevel, type CefrLevel } from "@/lib/cefr";
import type { GenerationMeta, VariantPair } from "@/lib/contracts/generation";

export type SocialMessage = {
  id: string;
  speaker: string;
  text: string;
  time: string | null;
  emoji: string | null;
  tags: string[];
};

export type SocialThreadVariant = {
  messages: SocialMessage[];
};

export type SocialConcept = {
  id: string;
  term: string;
  definition: string;
  example: string | null;
};

export type SocialCheck = {
  id: string;
  prompt: string;
  answer: string;
};

export type SocialPackData = GenerationMeta & {
  title: string;
  subtitle: string | null;
  meta: {
    model: string;
    source: string;
  };
  concepts: SocialConcept[];
  checks: SocialCheck[];
  standard: SocialThreadVariant;
  supported: SocialThreadVariant;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeMessage(value: unknown, index: number): SocialMessage {
  const obj = asRecord(value);
  return {
    id: asString(obj.id).trim() || `m-${index + 1}`,
    speaker: asString(obj.speaker ?? obj.name ?? obj.participant).trim() || "Someone",
    text: asString(obj.text ?? obj.message ?? obj.content).trim(),
    time: asNullableString(obj.time),
    emoji: asNullableString(obj.emoji ?? obj.reaction),
    tags: asStringArray(obj.tags ?? obj.tag),
  };
}

function normalizeMessages(value: unknown): SocialMessage[] {
  const obj = asRecord(value);
  const raw = Array.isArray(value)
    ? value
    : Array.isArray(obj.messages)
      ? obj.messages
      : Array.isArray(obj.thread)
        ? obj.thread
        : Array.isArray(obj.chat)
          ? obj.chat
          : Array.isArray(obj.items)
            ? obj.items
            : [];
  return raw.map(normalizeMessage);
}

function normalizeConcept(value: unknown, index: number): SocialConcept {
  const obj = asRecord(value);
  return {
    id: asString(obj.id).trim() || `concept-${index + 1}`,
    term: asString(obj.term ?? obj.word ?? obj.title ?? obj.name).trim(),
    definition: asString(obj.definition ?? obj.def ?? obj.meaning ?? obj.explain).trim(),
    example: asNullableString(obj.example ?? obj.examples ?? obj.use),
  };
}

function normalizeCheck(value: unknown, index: number): SocialCheck {
  const obj = asRecord(value);
  return {
    id: asString(obj.id).trim() || `check-${index + 1}`,
    prompt: asString(obj.prompt ?? obj.question).trim(),
    answer: asString(obj.answer ?? obj.answerKey ?? obj.key).trim(),
  };
}

function pickLegacyChecks(source: UnknownRecord, standard: UnknownRecord, supported: UnknownRecord): unknown[] {
  if (Array.isArray(source.checks)) return source.checks;
  if (Array.isArray(standard.checks)) return standard.checks;
  if (Array.isArray(supported.checks)) return supported.checks;
  return [];
}

export function normalizeSocialPack(
  input: unknown,
  defaults: { cefrLevel?: CefrLevel } = {}
): SocialPackData {
  const obj = asRecord(input);
  const nested = asRecord(obj.pack);
  const source = Object.keys(nested).length ? nested : obj;

  const standardObj = asRecord(source.standard ?? source.STANDARD);
  const supportedObj = asRecord(source.supported ?? source.SUPPORTED ?? source.adapted);
  const legacyVariants = asRecord(source.variants);
  const standardVariant = Object.keys(standardObj).length ? standardObj : asRecord(legacyVariants.standard);
  const supportedVariant = Object.keys(supportedObj).length
    ? supportedObj
    : asRecord(legacyVariants.supported ?? legacyVariants.SUPPORTED ?? legacyVariants.adapted);

  const standardMessages = normalizeMessages(standardVariant);
  const supportedMessages = normalizeMessages(supportedVariant);
  const meta = asRecord(source.meta);
  const rawConcepts = Array.isArray(source.concepts)
    ? source.concepts
    : Array.isArray(source.vocab)
      ? source.vocab
      : Array.isArray(source.glossary)
        ? source.glossary
        : [];
  const rawChecks = pickLegacyChecks(source, standardVariant, supportedVariant);

  return {
    schemaVersion: 2,
    cefrLevel: parseCefrLevel(source.cefrLevel ?? source.level, defaults.cefrLevel ?? "B1"),
    textType: "short_message",
    title: asString(source.title ?? source.topic ?? source.unitTitle).trim() || "Social Thread",
    subtitle: asNullableString(source.subtitle),
    meta: {
      model: asString(meta.model).trim() || "unknown",
      source: asString(meta.source).trim() || "social-thread",
    },
    concepts: rawConcepts.map(normalizeConcept),
    checks: rawChecks.map(normalizeCheck),
    standard: { messages: standardMessages },
    supported: { messages: supportedMessages.length ? supportedMessages : standardMessages.map((m) => ({ ...m })) },
  };
}

export function alignSocialVariants(pack: SocialPackData): SocialPackData {
  const standard = pack.standard.messages;
  const supported = pack.supported.messages;
  const count = Math.min(standard.length, supported.length);

  const alignedStandard = standard.slice(0, count).map((message, index) => ({
    ...message,
    id: `m-${index + 1}`,
  }));

  const alignedSupported = supported.slice(0, count).map((message, index) => ({
    ...message,
    id: `m-${index + 1}`,
  }));

  return {
    ...pack,
    checks: pack.checks.map((check, index) => ({ ...check, id: `check-${index + 1}` })),
    standard: { messages: alignedStandard },
    supported: { messages: alignedSupported },
  };
}

export function validateSocialPack(
  pack: SocialPackData,
  requirements: { messageCount?: number; minConcepts?: number } = {}
): string[] {
  const errors: string[] = [];
  const messageCount = requirements.messageCount;
  const minConcepts = requirements.minConcepts ?? 0;
  const standard = pack.standard.messages;
  const supported = pack.supported.messages;

  if (messageCount != null && standard.length !== messageCount) {
    errors.push(`Standard thread must contain exactly ${messageCount} messages.`);
  }
  if (messageCount != null && supported.length !== messageCount) {
    errors.push(`Supported thread must contain exactly ${messageCount} messages.`);
  }
  if (standard.length !== supported.length) {
    errors.push("Standard and Supported threads must contain the same number of messages.");
  }
  if (pack.concepts.length < minConcepts) {
    errors.push(`Social thread must contain at least ${minConcepts} concepts.`);
  }
  if (!pack.checks.length) errors.push("Social thread must contain shared comprehension checks.");

  const seenMessageIds = new Set<string>();
  standard.forEach((message, index) => {
    const supportedMessage = supported[index];
    if (!message.id) errors.push(`Standard message ${index + 1} has no id.`);
    if (seenMessageIds.has(message.id)) errors.push(`Standard message id ${message.id} is duplicated.`);
    seenMessageIds.add(message.id);
    if (!message.speaker.trim()) errors.push(`Standard message ${index + 1} has no speaker.`);
    if (!message.text.trim()) errors.push(`Standard message ${index + 1} has no text.`);
    if (!supportedMessage) return;
    if (supportedMessage.id !== message.id) {
      errors.push(`Message ${index + 1} is not aligned: ${message.id} vs ${supportedMessage.id}.`);
    }
    if (!supportedMessage.speaker.trim()) errors.push(`Supported message ${index + 1} has no speaker.`);
    if (!supportedMessage.text.trim()) errors.push(`Supported message ${index + 1} has no text.`);
  });

  const seenConceptIds = new Set<string>();
  pack.concepts.forEach((concept, index) => {
    if (!concept.id) errors.push(`Concept ${index + 1} has no id.`);
    if (seenConceptIds.has(concept.id)) errors.push(`Concept id ${concept.id} is duplicated.`);
    seenConceptIds.add(concept.id);
    if (!concept.term.trim()) errors.push(`Concept ${index + 1} has no term.`);
    if (!concept.definition.trim()) errors.push(`Concept ${index + 1} has no definition.`);
  });

  const seenCheckIds = new Set<string>();
  pack.checks.forEach((check, index) => {
    if (!check.id) errors.push(`Check ${index + 1} has no id.`);
    if (seenCheckIds.has(check.id)) errors.push(`Check id ${check.id} is duplicated.`);
    seenCheckIds.add(check.id);
    if (!check.prompt.trim()) errors.push(`Check ${index + 1} has no prompt.`);
    if (!check.answer.trim()) errors.push(`Check ${index + 1} has no shared answer.`);
  });

  return errors;
}

export function makeSocialVariantPair(pack: SocialPackData): VariantPair<SocialThreadVariant> {
  return { standard: pack.standard, supported: pack.supported };
}
