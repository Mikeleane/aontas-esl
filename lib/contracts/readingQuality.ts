import type { ReadingPackData } from "./reading";

export type ReadingQualityLimits = {
  standardMinWords: number;
  supportedMinWords: number;
};

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function isLikelyObjective(value: string): boolean {
  return /^(understand and use|students will|learning objectives?|this (text|reading) (is|will|helps))/i.test(value.trim());
}

/**
 * Fast, deterministic checks. These prevent structural answer-key failures;
 * they do not establish factual truth or CEFR accuracy on their own.
 */
export function validateReadingPackQuality(pack: ReadingPackData, limits: ReadingQualityLimits): string[] {
  const issues: string[] = [];
  const standardReading = pack.reading.standard.trim();
  const supportedReading = pack.reading.supported.trim();
  const standardWords = wordCount(standardReading);
  const supportedWords = wordCount(supportedReading);

  if (standardWords < limits.standardMinWords) {
    issues.push("Standard reading has " + standardWords + " words; minimum is " + limits.standardMinWords + ".");
  }
  if (supportedWords < limits.supportedMinWords) {
    issues.push("Supported reading has " + supportedWords + " words; minimum is " + limits.supportedMinWords + ".");
  }
  if (isLikelyObjective(standardReading)) issues.push("Standard reading appears to be a learning objective rather than a passage.");
  if (isLikelyObjective(supportedReading)) issues.push("Supported reading appears to be a learning objective rather than a passage.");
  if (standardReading === supportedReading) issues.push("Standard and Supported readings are identical.");

  for (const exercise of pack.exercises) {
    const type = exercise.type.trim().toLowerCase();
    if (type !== "multiple_choice" && type !== "true_false") continue;

    const standardOptions = exercise.standard.options;
    const supportedOptions = exercise.supported.options;
    const index = exercise.answerIndex;
    const label = "Exercise " + exercise.id + ": ";

    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      !Array.isArray(standardOptions) ||
      !Array.isArray(supportedOptions) ||
      standardOptions.length < 2 ||
      supportedOptions.length < 2 ||
      index < 0 ||
      index >= standardOptions.length ||
      index >= supportedOptions.length
    ) {
      issues.push(label + "invalid shared answer index or missing options.");
      continue;
    }

    if (type === "true_false") {
      // Two different statements can have opposite truth values, so sharing an
      // answerIndex is only safe when both variants ask exactly the same proposition.
      if (exercise.standard.prompt.trim() !== exercise.supported.prompt.trim()) {
        issues.push(label + "True/False statements differ between Standard and Supported; shared answers are unsafe.");
      }
      const canonical = ["True", "False"];
      if (
        standardOptions.length !== 2 ||
        supportedOptions.length !== 2 ||
        standardOptions.some((option, i) => option.trim() !== canonical[i]) ||
        supportedOptions.some((option, i) => option.trim() !== canonical[i])
      ) {
        issues.push(label + "True/False options must be [True, False] in both variants.");
      }
      const answer = typeof exercise.answer === "string" ? exercise.answer.trim().toLowerCase() : "";
      if (answer !== "true" && answer !== "false") {
        issues.push(label + "True/False answer must be True or False.");
      } else if (index !== (answer === "true" ? 0 : 1)) {
        issues.push(label + "True/False answer and shared index disagree.");
      }
    }
  }

  return issues;
}
