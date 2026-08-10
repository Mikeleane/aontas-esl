import { cefrToStageBand, parseCefrLevel } from "./cefr";

/**
 * Legacy-only compatibility shim. New ESL generation must use CEFR directly.
 */
export function stageFromCefr(input: unknown): number {
  return cefrToStageBand(parseCefrLevel(input));
}
