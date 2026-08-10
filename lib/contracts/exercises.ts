import { parseCefrLevel, parseTextType, type CefrLevel, type TextType } from "@/lib/cefr";
import type { GenerationMeta } from "@/lib/contracts/generation";

export type ExerciseSide = {
  prompt: string;
  options?: string[];
};

export type ExerciseAnswer = string | string[];

export type ExerciseItem = {
  id: string;
  type: string;
  skill?: string;
  standard: ExerciseSide;
  supported: ExerciseSide;
  answer: ExerciseAnswer;
  answerIndex?: number;
};

export type ExercisesPackData = GenerationMeta & {
  items: ExerciseItem[];
  warning?: string;
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

function asOptionalString(value: unknown): string | undefined {
  const text = asString(value).trim();
  return text || undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.map((item) => String(item ?? "").trim()).filter(Boolean);
  return out.length ? out : undefined;
}

function normalizeSide(value: unknown, fallback: ExerciseSide = { prompt: "" }): ExerciseSide {
  const obj = asRecord(value);
  const prompt = asString(obj.prompt).trim() || fallback.prompt;
  const options = asStringArray(obj.options) ?? fallback.options;
  return options ? { prompt, options } : { prompt };
}

function normalizeAnswer(value: unknown): ExerciseAnswer {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (value == null) return "";
  return String(value).trim();
}

export function normalizeExerciseItem(value: unknown, index = 0): ExerciseItem {
  const obj = asRecord(value);
  const legacyFlatStandard = typeof obj.prompt === "string"
    ? { prompt: obj.prompt, options: obj.options }
    : undefined;
  const standard = normalizeSide(obj.standard ?? legacyFlatStandard);

  // This is the only compatibility boundary for historical exercise variant names.
  const supported = normalizeSide(obj.supported ?? obj.SUPPORTED ?? obj.adapted, standard);
  const answerIndex = Number(obj.answerIndex);
  const rawId = obj.id;
  const id = typeof rawId === "string" || typeof rawId === "number"
    ? String(rawId).trim()
    : "";

  return {
    id: id || String(index + 1),
    type: asString(obj.type).trim() || "exercise",
    ...(asOptionalString(obj.skill) ? { skill: asOptionalString(obj.skill) } : {}),
    standard,
    supported,
    answer: normalizeAnswer(obj.answer),
    ...(Number.isInteger(answerIndex) ? { answerIndex } : {}),
  };
}

export function normalizeExercisesPack(
  input: unknown,
  defaults: { cefrLevel?: CefrLevel; textType?: TextType } = {}
): ExercisesPackData {
  const obj = asRecord(input);
  const nested = asRecord(obj.pack);
  const source = Object.keys(nested).length ? nested : obj;
  const rawItems = Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.exercises)
      ? source.exercises
      : Array.isArray(asRecord(source.exercises).items)
        ? asRecord(source.exercises).items as unknown[]
        : [];

  return {
    schemaVersion: 2,
    cefrLevel: parseCefrLevel(source.cefrLevel ?? source.level, defaults.cefrLevel ?? "B1"),
    textType: parseTextType(source.textType ?? source.text_type ?? source.genre, defaults.textType ?? "article"),
    items: rawItems.map(normalizeExerciseItem),
    ...(asOptionalString(source.warning) ? { warning: asOptionalString(source.warning) } : {}),
  };
}

function answerIsPresent(answer: ExerciseAnswer): boolean {
  if (Array.isArray(answer)) return answer.length > 0 && answer.every((value) => value.trim().length > 0);
  return answer.trim().length > 0;
}

export function validateExercisesPack(pack: ExercisesPackData): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  pack.items.forEach((item, index) => {
    const label = `Exercise ${index + 1}`;
    if (!item.id) errors.push(`${label} has no id.`);
    if (seen.has(item.id)) errors.push(`${label} repeats id ${item.id}.`);
    seen.add(item.id);
    if (!item.standard.prompt.trim()) errors.push(`${label} has no Standard prompt.`);
    if (!item.supported.prompt.trim()) errors.push(`${label} has no Supported prompt.`);
    if (!answerIsPresent(item.answer)) errors.push(`${label} has no shared answer.`);
  });

  return errors;
}
