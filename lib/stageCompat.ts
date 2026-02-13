import { parseCefrLevel } from "./cefrCambridge";

/**
 * Compatibility shim: old "stage" -> CEFR mapping.
 * 2->A2, 3->B1, 4->B2, 5->C1, 6->C2
 */
export function stageFromCefr(input: unknown): number {
  const lvl = parseCefrLevel(input);
  switch (lvl) {
    case "A2": return 2;
    case "B1": return 3;
    case "B2": return 4;
    case "C1": return 5;
    case "C2": return 6;
  }
}