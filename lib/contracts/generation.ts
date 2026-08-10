import type { CefrLevel, TextType } from "@/lib/cefr";

export const OUTPUT_VARIANTS = ["standard", "supported"] as const;
export type OutputVariant = (typeof OUTPUT_VARIANTS)[number];

export type VariantPair<T> = {
  standard: T;
  supported: T;
};

export type GenerationMeta = {
  schemaVersion: 2;
  cefrLevel: CefrLevel;
  textType: TextType;
};
