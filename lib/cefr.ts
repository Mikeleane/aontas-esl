export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const TEXT_TYPES = [
  "story",
  "short_message",
  "email_informal",
  "email_formal",
  "article",
  "review",
  "report",
  "essay",
] as const;
export type TextType = (typeof TEXT_TYPES)[number];
export type Register = "informal" | "neutral" | "formal";

export type WordTarget = {
  min: number;
  target: number;
  max: number;
  maxSentenceWords: number;
};

const BASE_TARGETS: Record<CefrLevel, WordTarget> = {
  A1: { min: 70, target: 95, max: 130, maxSentenceWords: 12 },
  A2: { min: 120, target: 160, max: 210, maxSentenceWords: 16 },
  B1: { min: 200, target: 260, max: 340, maxSentenceWords: 20 },
  B2: { min: 320, target: 400, max: 520, maxSentenceWords: 24 },
  C1: { min: 480, target: 600, max: 760, maxSentenceWords: 28 },
  C2: { min: 700, target: 850, max: 1100, maxSentenceWords: 32 },
};

const SHORT_MESSAGE_TARGETS: Record<CefrLevel, WordTarget> = {
  A1: { min: 25, target: 40, max: 60, maxSentenceWords: 10 },
  A2: { min: 40, target: 60, max: 80, maxSentenceWords: 14 },
  B1: { min: 60, target: 90, max: 120, maxSentenceWords: 18 },
  B2: { min: 80, target: 120, max: 160, maxSentenceWords: 22 },
  C1: { min: 120, target: 170, max: 220, maxSentenceWords: 26 },
  C2: { min: 140, target: 200, max: 260, maxSentenceWords: 30 },
};

const EMAIL_TARGETS: Record<CefrLevel, WordTarget> = {
  A1: { min: 50, target: 70, max: 100, maxSentenceWords: 11 },
  A2: { min: 90, target: 130, max: 180, maxSentenceWords: 15 },
  B1: { min: 140, target: 190, max: 250, maxSentenceWords: 19 },
  B2: { min: 180, target: 240, max: 320, maxSentenceWords: 23 },
  C1: { min: 230, target: 300, max: 390, maxSentenceWords: 27 },
  C2: { min: 270, target: 350, max: 450, maxSentenceWords: 31 },
};

function normalizeToken(input: unknown): string {
  return String(input ?? "").trim().toUpperCase();
}

export function parseCefrLevel(input: unknown, fallback: CefrLevel = "B1"): CefrLevel {
  const token = normalizeToken(input);
  if ((CEFR_LEVELS as readonly string[]).includes(token)) return token as CefrLevel;

  const numeric = Number(token);
  if (Number.isFinite(numeric) && token !== "") {
    if (numeric <= 1) return "A1";
    if (numeric === 2) return "A2";
    if (numeric === 3) return "B1";
    if (numeric === 4) return "B2";
    if (numeric === 5) return "C1";
    return "C2";
  }

  const aliases: Array<[RegExp, CefrLevel]> = [
    [/\bBEGINNER\b/, "A1"],
    [/\bELEMENTARY\b|PRE[- ]?INTERMEDIATE/, "A2"],
    [/\bUPPER[- ]?INTERMEDIATE\b/, "B2"],
    [/\bINTERMEDIATE\b/, "B1"],
    [/\bADVANCED\b/, "C1"],
    [/\bPROFICIENCY\b|\bMASTERY\b/, "C2"],
  ];
  for (const [pattern, level] of aliases) {
    if (pattern.test(token)) return level;
  }

  for (const level of CEFR_LEVELS) {
    if (token.includes(level)) return level;
  }
  return fallback;
}

export function parseTextType(input: unknown, fallback: TextType = "article"): TextType {
  const raw = String(input ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((TEXT_TYPES as readonly string[]).includes(raw)) return raw as TextType;
  if (raw === "email" || raw === "informal_email") return "email_informal";
  if (raw === "formal_email") return "email_formal";
  if (raw === "message" || raw === "note" || raw === "short_note") return "short_message";
  return fallback;
}

export function getRegisterForTextType(type: TextType): Register {
  if (type === "email_formal" || type === "report" || type === "essay") return "formal";
  if (type === "email_informal" || type === "short_message" || type === "story") return "informal";
  return "neutral";
}

export function getWordTarget(level: CefrLevel, type: TextType = "article"): WordTarget {
  if (type === "short_message") return SHORT_MESSAGE_TARGETS[level];
  if (type === "email_formal" || type === "email_informal") return EMAIL_TARGETS[level];
  return BASE_TARGETS[level];
}

export function getLengthTargets(level: CefrLevel): WordTarget {
  return BASE_TARGETS[level];
}

export function cefrStyleGuide(level: CefrLevel): string {
  switch (level) {
    case "A1":
      return [
        "Language: very high-frequency vocabulary and concrete meanings.",
        "Grammar: short simple clauses; mainly present simple with limited past forms where essential.",
        "Cohesion: basic sequencing and linkers such as and, but, because, then.",
        "Clarity: explicit subjects and references; avoid dense noun phrases.",
      ].join("\n");
    case "A2":
      return [
        "Language: high-frequency vocabulary and familiar concrete topics.",
        "Grammar: present and past simple; limited subordination and common modals.",
        "Cohesion: basic linkers such as and, but, because, so, then.",
        "Clarity: mostly short sentences with explicit references.",
      ].join("\n");
    case "B1":
      return [
        "Language: everyday topics plus some abstract ideas; controlled variety.",
        "Grammar: present perfect, past continuous and common modals where natural.",
        "Cohesion: wider linkers such as however, although, so and as a result.",
        "Paragraphing: clear topic development and referencing.",
      ].join("\n");
    case "B2":
      return [
        "Language: more precise vocabulary and natural collocations.",
        "Grammar: controlled relative clauses, conditionals, passives and varied modals.",
        "Cohesion: clear argument flow, referencing, contrast and concession.",
      ].join("\n");
    case "C1":
      return [
        "Language: nuanced tone, hedging and stance markers where appropriate.",
        "Grammar: complex sentences with control and accurate cohesion.",
        "Discourse: clear rhetorical structure with subtle contrast and concession.",
      ].join("\n");
    case "C2":
      return [
        "Language: precise, flexible and natural, including lower-frequency lexis where justified.",
        "Discourse: sophisticated organisation and controlled tone shifts.",
        "Accuracy: near-native control without forced or showy wording.",
      ].join("\n");
  }
}

export function textTypeSpec(type: TextType): string {
  switch (type) {
    case "story":
      return "Story: clear beginning, development and ending; characters and setting; dialogue only where useful.";
    case "short_message":
      return "Short message: direct purpose, concise wording and an unmistakable message/note format.";
    case "email_informal":
      return "Informal email: subject, greeting, clear body, closing line and sign-off in a friendly register.";
    case "email_formal":
      return "Formal email: subject, formal greeting, clear purpose, polite closing and full-name sign-off.";
    case "article":
      return "Article: title and clear paragraphs; subheadings may be used where they improve navigation.";
    case "review":
      return "Review: identify the subject, describe key features, give reasons for opinions and make a recommendation.";
    case "report":
      return "Report: clear headings with an introduction, findings and recommendations.";
    case "essay":
      return "Essay: introduction with a clear position, developed body paragraphs and a conclusion.";
  }
}

export function buildCefrConstraints(level: CefrLevel, type: TextType): string {
  const target = getWordTarget(level, type);
  return [
    `CEFR level: ${level}`,
    `Text type: ${type}`,
    `Register: ${getRegisterForTextType(type)}`,
    `Target length: ${target.target} words (acceptable range: ${target.min}-${target.max})`,
    `Sentence-length guide: normally no more than about ${target.maxSentenceWords} words per sentence.`,
    "",
    "Text-type requirements:",
    textTypeSpec(type),
    "",
    "Level style guide:",
    cefrStyleGuide(level),
    "",
    "Hard rules:",
    "- Keep the text within the target word range unless preserving teacher-provided source facts requires a small deviation.",
    "- Make the format unmistakably match the selected text type.",
    "- standard and supported must share one learning target and one answer key; supports are additive only.",
    "- Use plain ASCII punctuation in generated JSON strings.",
  ].join("\n");
}

// Compatibility aliases for older imports. New code should use the canonical names above.
export const buildCambridgeConstraints = buildCefrConstraints;
export const cambridgeTextTypeSpec = textTypeSpec;
