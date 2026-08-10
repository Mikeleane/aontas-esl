import { parseCefrLevel, type CefrLevel } from "./cefr";

/** Legacy-only compatibility shim. New ESL generation must use CEFR directly. */
export function stageFromCefr(input: unknown): number {
  const level = parseCefrLevel(input);
  const bands: Record<CefrLevel, number> = {
    A1: 1,
    A2: 2,
    B1: 3,
    B2: 4,
    C1: 5,
    C2: 6,
  };
  return bands[level];
}

export function cefrFromStage(input: unknown): CefrLevel {
  const stage = Number(input);
  if (!Number.isFinite(stage) || stage <= 1) return "A1";
  if (stage === 2) return "A2";
  if (stage === 3) return "B1";
  if (stage === 4) return "B2";
  if (stage === 5) return "C1";
  return "C2";
}
