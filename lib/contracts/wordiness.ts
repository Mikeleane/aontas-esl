import { parseCefrLevel, parseTextType, type CefrLevel, type TextType } from "@/lib/cefr";
import type { OutputVariant, VariantPair } from "@/lib/contracts/generation";

export type WordinessConnector = {
  sentence: string;
  connector: string;
};

export type WordinessVariantSeed = {
  text: string;
  seedText: string;
  sentences: string[];
  words: string[];
  structures: {
    connectors: WordinessConnector[];
  };
};

export type WordinessSeedMeta = {
  createdAt: string;
  source?: string;
  title?: string;
};

export type WordinessSeed = {
  schemaVersion: 2;
  cefrLevel: CefrLevel;
  textType: TextType;
  activeVariant: OutputVariant;
  variants: VariantPair<WordinessVariantSeed>;
  meta: WordinessSeedMeta;
};

export type WordinessGameSeed = WordinessVariantSeed & {
  schemaVersion: 2;
  cefrLevel: CefrLevel;
  textType: TextType;
  activeVariant: OutputVariant;
  standard: WordinessVariantSeed;
  supported: WordinessVariantSeed;
  meta: WordinessSeedMeta & { mode: OutputVariant };
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cleanText(value: unknown): string {
  return asString(value).replace(/\s+/g, " ").trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).map((item) => item.trim()).filter(Boolean);
}

export function splitWordinessSentences(text: string): string[] {
  const clean = cleanText(text);
  if (!clean) return [];
  const parts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return parts
    .map((sentence) => sentence.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 100);
}

export function extractWordinessWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of matches) {
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= 500) break;
  }
  return out;
}

export function extractWordinessConnectors(sentences: string[]): WordinessConnector[] {
  const connectors = [
    "because", "although", "however", "therefore", "while", "when", "if",
    "but", "so", "then", "and", "or", "before", "after", "unless", "since",
  ];
  const out: WordinessConnector[] = [];
  for (const sentence of sentences) {
    const lower = ` ${sentence.toLowerCase()} `;
    const connector = connectors.find((item) => lower.includes(` ${item} `));
    if (connector) out.push({ sentence, connector });
    if (out.length >= 80) break;
  }
  return out;
}

export function buildWordinessVariantSeed(text: string): WordinessVariantSeed {
  const seedText = cleanText(text);
  const sentences = splitWordinessSentences(seedText);
  return {
    text: seedText,
    seedText,
    sentences,
    words: extractWordinessWords(seedText),
    structures: { connectors: extractWordinessConnectors(sentences) },
  };
}

function normalizeVariant(value: unknown, fallbackText = ""): WordinessVariantSeed {
  const record = asRecord(value);
  const text = cleanText(record.text || record.seedText || fallbackText);
  const built = buildWordinessVariantSeed(text);
  const sentences = asStringArray(record.sentences);
  const words = asStringArray(record.words);
  const structures = asRecord(record.structures);
  const rawConnectors = Array.isArray(structures.connectors) ? structures.connectors : [];
  const connectors = rawConnectors
    .map((item) => {
      const obj = asRecord(item);
      const sentence = asString(obj.sentence).trim();
      const connector = asString(obj.connector).trim();
      return sentence && connector ? { sentence, connector } : null;
    })
    .filter((item): item is WordinessConnector => Boolean(item));

  return {
    text,
    seedText: text,
    sentences: sentences.length ? sentences : built.sentences,
    words: words.length ? words : built.words,
    structures: { connectors: connectors.length ? connectors : built.structures.connectors },
  };
}

function parseVariant(value: unknown, fallback: OutputVariant = "standard"): OutputVariant {
  const token = String(value ?? "").trim().toLowerCase();
  if (token === "supported" || token === "adapted" || token === "b") return "supported";
  if (token === "standard" || token === "a") return "standard";
  return fallback;
}

export function buildWordinessSeedFromVariants(input: {
  standard: string;
  supported?: string;
  cefrLevel?: CefrLevel;
  textType?: TextType;
  activeVariant?: OutputVariant;
  source?: string;
  title?: string;
}): WordinessSeed {
  const standardText = cleanText(input.standard);
  const supportedText = cleanText(input.supported) || standardText;
  const standard = buildWordinessVariantSeed(standardText || supportedText);
  const supported = buildWordinessVariantSeed(supportedText || standardText);
  return {
    schemaVersion: 2,
    cefrLevel: parseCefrLevel(input.cefrLevel, "B1"),
    textType: parseTextType(input.textType, "article"),
    activeVariant: input.activeVariant ?? "standard",
    variants: { standard, supported },
    meta: {
      createdAt: new Date().toISOString(),
      ...(input.source ? { source: input.source } : {}),
      ...(input.title ? { title: input.title } : {}),
    },
  };
}

export function normalizeWordinessSeed(
  value: unknown,
  defaults: Partial<Pick<WordinessSeed, "cefrLevel" | "textType" | "activeVariant">> = {},
): WordinessSeed {
  const root = asRecord(value);
  const meta = asRecord(root.meta);
  const variants = asRecord(root.variants);
  const standardRecord = asRecord(variants.standard || root.standard);
  const supportedRecord = asRecord(variants.supported || root.supported || root.SUPPORTED || root.adapted);

  // Legacy Wordiness seeds were flat: { seedText, sentences, words, structures, meta }.
  const flatText = cleanText(root.text || root.seedText);
  const standardText = cleanText(standardRecord.text || standardRecord.seedText) || flatText;
  const supportedText = cleanText(supportedRecord.text || supportedRecord.seedText) || standardText || flatText;
  const standard = Object.keys(standardRecord).length
    ? normalizeVariant(standardRecord, standardText)
    : normalizeVariant(root, standardText);
  const supported = Object.keys(supportedRecord).length
    ? normalizeVariant(supportedRecord, supportedText)
    : normalizeVariant(root, supportedText || standard.text);

  const activeVariant = parseVariant(
    root.activeVariant || meta.mode,
    defaults.activeVariant ?? "standard",
  );

  return {
    schemaVersion: 2,
    cefrLevel: parseCefrLevel(root.cefrLevel || meta.cefrLevel, defaults.cefrLevel ?? "B1"),
    textType: parseTextType(root.textType || meta.textType, defaults.textType ?? "article"),
    activeVariant,
    variants: {
      standard: standard.text ? standard : supported,
      supported: supported.text ? supported : standard,
    },
    meta: {
      createdAt: asString(meta.createdAt).trim() || new Date().toISOString(),
      ...(asString(meta.source).trim() ? { source: asString(meta.source).trim() } : {}),
      ...(asString(meta.title).trim() ? { title: asString(meta.title).trim() } : {}),
    },
  };
}

export function selectWordinessSeedVariant(
  seedLike: unknown,
  variant?: OutputVariant,
): WordinessGameSeed {
  const seed = normalizeWordinessSeed(seedLike);
  const activeVariant = variant ?? seed.activeVariant;
  const selected = seed.variants[activeVariant];
  return {
    ...selected,
    schemaVersion: 2,
    cefrLevel: seed.cefrLevel,
    textType: seed.textType,
    activeVariant,
    standard: seed.variants.standard,
    supported: seed.variants.supported,
    meta: { ...seed.meta, mode: activeVariant },
  };
}
