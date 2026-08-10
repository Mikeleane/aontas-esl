import { parseCefrLevel, parseTextType, type CefrLevel, type TextType } from "@/lib/cefr";

export type AdaptPack = {
  schemaVersion: 2;
  cefrLevel: CefrLevel;
  textType: TextType;
  outputLanguage: string;
  standard: string;
  supported: string;
  degraded?: true;
  warning?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAdaptPack(
  input: unknown,
  defaults: { cefrLevel?: CefrLevel; textType?: TextType; outputLanguage?: string } = {}
): AdaptPack {
  const root = asRecord(input);
  const pack = asRecord(root.pack ?? input);

  const standard =
    asString(pack.standard) ||
    asString(pack.standardOutput) ||
    asString(root.standard) ||
    asString(root.standardOutput);

  const supported =
    asString(pack.supported) ||
    asString(pack.supportedOutput) ||
    asString(pack.adapted) ||
    asString(pack.adaptedOutput) ||
    asString(root.supported) ||
    asString(root.supportedOutput) ||
    asString(root.adapted) ||
    asString(root.adaptedOutput) ||
    standard;

  return {
    schemaVersion: 2,
    cefrLevel: parseCefrLevel(pack.cefrLevel ?? root.cefrLevel ?? root.level ?? defaults.cefrLevel ?? "B1"),
    textType: parseTextType(pack.textType ?? root.textType ?? root.outputType ?? defaults.textType ?? "article"),
    outputLanguage:
      asString(pack.outputLanguage) || asString(root.outputLanguage) || defaults.outputLanguage || "English",
    standard,
    supported,
    ...(pack.degraded === true || root.degraded === true ? { degraded: true as const } : {}),
    ...((asString(pack.warning) || asString(root.warning))
      ? { warning: asString(pack.warning) || asString(root.warning) }
      : {}),
  };
}
