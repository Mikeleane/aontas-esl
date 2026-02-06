export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export type LengthTargets = {
  minWords: number;
  targetWords: number;
  maxWords: number;
  maxSentenceWords: number;
};

// TUNING KNOB — not gospel. Designed for “Cambridge-ish” reading text length bands.
export const CEFR_LENGTH_TARGETS: Record<CefrLevel, LengthTargets> = {
  A1: { minWords: 70,  targetWords: 95,  maxWords: 130,  maxSentenceWords: 12 },
  A2: { minWords: 120, targetWords: 160, maxWords: 210,  maxSentenceWords: 16 },
  B1: { minWords: 200, targetWords: 260, maxWords: 340,  maxSentenceWords: 20 },
  B2: { minWords: 320, targetWords: 400, maxWords: 520,  maxSentenceWords: 24 },
  C1: { minWords: 480, targetWords: 600, maxWords: 760,  maxSentenceWords: 28 },
  C2: { minWords: 700, targetWords: 850, maxWords: 1100, maxSentenceWords: 32 },
};

function norm(s: string) {
  return s.trim().toUpperCase();
}

export function parseCefrLevel(v: any, fallback: CefrLevel = "B1"): CefrLevel {
  const raw =
    typeof v === "string" ? v :
    typeof v === "number" ? String(v) :
    "";

  const s = norm(raw);

  if ((CEFR_LEVELS as string[]).includes(s)) return s as CefrLevel;

  // Friendly aliases (optional)
  if (s.includes("BEGINNER")) return "A1";
  if (s.includes("ELEMENTARY")) return "A2";
  if (s.includes("PRE-INTERMEDIATE") || s === "PREINTERMEDIATE") return "A2";
  if (s.includes("INTERMEDIATE")) return "B1";
  if (s.includes("UPPER-INTERMEDIATE") || s === "UPPERINTERMEDIATE") return "B2";
  if (s.includes("ADVANCED")) return "C1";
  if (s.includes("PROFICIENCY") || s.includes("MASTERY")) return "C2";

  // If someone passes “Auto (B1)” etc.
  for (const lvl of CEFR_LEVELS) {
    if (s.includes(lvl)) return lvl;
  }

  return fallback;
}

// Legacy mapping for any old “stage-based heuristics” still hanging around.
// (We’ll slowly delete this later.)
export function cefrToStageBand(level: CefrLevel): number {
  switch (level) {
    case "A1": return 1;
    case "A2": return 2;
    case "B1": return 3;
    default:   return 4; // B2/C1/C2 band
  }
}

export function stageBandToCefr(stage: number): CefrLevel {
  if (stage <= 1) return "A1";
  if (stage === 2) return "A2";
  if (stage === 3) return "B1";
  return "B2";
}

export function getLengthTargets(level: CefrLevel): LengthTargets {
  return CEFR_LENGTH_TARGETS[level];
}
