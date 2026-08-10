import { parseCefrLevel, parseTextType } from "@/lib/cefr";
import type { GenerationMeta, OutputVariant, VariantPair } from "@/lib/contracts/generation";
import { normalizeExerciseItem, type ExerciseItem } from "@/lib/contracts/exercises";

export type ReadingMode = OutputVariant;

export type { ExerciseAnswer, ExerciseItem, ExerciseSide } from "@/lib/contracts/exercises";

export type MaterialType = "link" | "text" | "image" | "pdf" | "docx" | "other";

export type Material = {
  id: string;
  type: MaterialType;
  title: string;
  url?: string;
  rawText?: string;
  fileName?: string;
  mimeType?: string;
  fileDataUrl?: string;
  extractedText?: string;
  extractionStatus: "none" | "processing" | "done" | "needs_review" | "failed";
  useAsPrimaryText: boolean;
};

export type TeacherContext = {
  contextTags: string[];
  crossCurricularLinks: string[];
  authenticMaterialTypes: string[];
  localVocab: string;
  localGlossary: Array<{ term: string; note: string }>;
  useLocalContextExactly: boolean;
  onlyUseProvidedFacts: boolean;
};

export type ReadingPackData = GenerationMeta & {
  title: string;
  reading: VariantPair<string>;
  exercises: ExerciseItem[];
  crest?: string;
  materials?: Material[];
  primaryMaterialId?: string;
  teacherContext?: TeacherContext;
  pilotMode?: boolean;

  // Read-only compatibility metadata for old saved/exported packs.
  // New generation routes do not need these fields.
  legacy?: {
    stage?: number;
    schoolClass?: number;
  };
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asOptionalString(value: unknown): string | undefined {
  const text = asString(value).trim();
  return text ? text : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.map(asString).map((v) => v.trim()).filter(Boolean);
  return out.length ? out : undefined;
}

function normalizeMaterials(value: unknown): Material[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const materials: Material[] = value.map((item, index) => {
    const obj = asRecord(item);
    const extraction = asString(obj.extractionStatus);
    const validExtraction = ["none", "processing", "done", "needs_review", "failed"].includes(extraction)
      ? extraction as Material["extractionStatus"]
      : "none";
    const rawType = asString(obj.type);
    const validType = ["link", "text", "image", "pdf", "docx", "other"].includes(rawType)
      ? rawType as MaterialType
      : "other";
    return {
      id: asString(obj.id) || `material-${index + 1}`,
      type: validType,
      title: asString(obj.title) || `Material ${index + 1}`,
      ...(asOptionalString(obj.url) ? { url: asOptionalString(obj.url) } : {}),
      ...(asOptionalString(obj.rawText) ? { rawText: asOptionalString(obj.rawText) } : {}),
      ...(asOptionalString(obj.fileName) ? { fileName: asOptionalString(obj.fileName) } : {}),
      ...(asOptionalString(obj.mimeType) ? { mimeType: asOptionalString(obj.mimeType) } : {}),
      ...(asOptionalString(obj.fileDataUrl) ? { fileDataUrl: asOptionalString(obj.fileDataUrl) } : {}),
      ...(asOptionalString(obj.extractedText) ? { extractedText: asOptionalString(obj.extractedText) } : {}),
      extractionStatus: validExtraction,
      useAsPrimaryText: Boolean(obj.useAsPrimaryText),
    };
  });
  return materials.length ? materials : undefined;
}

function normalizeTeacherContext(value: unknown): TeacherContext | undefined {
  const obj = asRecord(value);
  if (!Object.keys(obj).length) return undefined;
  const glossary = Array.isArray(obj.localGlossary)
    ? obj.localGlossary.map((entry) => {
        const g = asRecord(entry);
        return { term: asString(g.term), note: asString(g.note) };
      }).filter((entry) => entry.term || entry.note)
    : [];
  return {
    contextTags: asStringArray(obj.contextTags) ?? [],
    crossCurricularLinks: asStringArray(obj.crossCurricularLinks) ?? [],
    authenticMaterialTypes: asStringArray(obj.authenticMaterialTypes) ?? [],
    localVocab: asString(obj.localVocab),
    localGlossary: glossary,
    useLocalContextExactly: obj.useLocalContextExactly !== false,
    onlyUseProvidedFacts: obj.onlyUseProvidedFacts !== false,
  };
}

export function normalizeReadingPack(input: unknown): ReadingPackData {
  const obj = asRecord(input);
  const nestedPack = asRecord(obj.pack);
  const source = Object.keys(nestedPack).length ? nestedPack : obj;
  const readingObj = asRecord(source.reading);

  const standardReading =
    asString(readingObj.standard) ||
    asString(source.standardText) ||
    asString(source.standard) ||
    asString(source.readingText) ||
    asString(source.text);

  const supportedReading =
    asString(readingObj.supported) ||
    asString(readingObj.SUPPORTED) ||
    asString(source.supportedText) ||
    asString(source.SUPPORTEDText) ||
    asString(source.adaptedText) ||
    asString(source.supported) ||
    asString(source.adapted) ||
    standardReading;

  const rawExercises = Array.isArray(source.exercises)
    ? source.exercises
    : Array.isArray(asRecord(source.exercises).items)
      ? asRecord(source.exercises).items as unknown[]
      : Array.isArray(source.items)
        ? source.items
        : [];

  const stage = Number(source.stage);
  const schoolClass = Number(source.schoolClass);

  const crest = asOptionalString(source.crest);
  const materials = normalizeMaterials(source.materials);
  const primaryMaterialId = asOptionalString(source.primaryMaterialId);
  const teacherContext = normalizeTeacherContext(source.teacherContext);

  return {
    schemaVersion: 2,
    title: asString(source.title) || "Reading Pack",
    cefrLevel: parseCefrLevel(source.cefrLevel ?? source.level ?? source.stage ?? "B1"),
    textType: parseTextType(source.textType ?? source.kind ?? "article"),
    reading: {
      standard: standardReading,
      supported: supportedReading,
    },
    exercises: rawExercises.map(normalizeExerciseItem),
    ...(crest ? { crest } : {}),
    ...(materials ? { materials } : {}),
    ...(primaryMaterialId ? { primaryMaterialId } : {}),
    ...(teacherContext ? { teacherContext } : {}),
    ...(typeof source.pilotMode === "boolean" ? { pilotMode: source.pilotMode } : {}),
    ...((Number.isFinite(stage) || Number.isFinite(schoolClass)) ? {
      legacy: {
        ...(Number.isFinite(stage) ? { stage } : {}),
        ...(Number.isFinite(schoolClass) ? { schoolClass } : {}),
      },
    } : {}),
  };
}
