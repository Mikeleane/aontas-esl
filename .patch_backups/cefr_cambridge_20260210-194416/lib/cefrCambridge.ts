// lib/cefrCambridge.ts

export const CEFR_LEVELS = ["A2", "B1", "B2", "C1", "C2"] as const;
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

export function parseCefrLevel(input: unknown): CefrLevel {
  const s = String(input ?? "").trim().toUpperCase();

  // Direct CEFR
  if (CEFR_LEVELS.includes(s as CefrLevel)) return s as CefrLevel;

  // Back-compat: numeric "stage/level" mapping (tweak if needed)
  // 2->A2, 3->B1, 4->B2, 5->C1, 6->C2
  const n = Number(s);
  if (!Number.isNaN(n)) {
    if (n <= 2) return "A2";
    if (n === 3) return "B1";
    if (n === 4) return "B2";
    if (n === 5) return "C1";
    return "C2";
  }

  return "B1";
}

export function parseTextType(input: unknown): TextType {
  const raw = String(input ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if ((TEXT_TYPES as readonly string[]).includes(raw)) return raw as TextType;

  // aliases
  if (raw === "email" || raw === "informal_email") return "email_informal";
  if (raw === "formal_email") return "email_formal";
  if (raw === "message" || raw === "note") return "short_message";

  return "article";
}

export function getRegisterForTextType(t: TextType): Register {
  if (t === "email_formal") return "formal";
  if (t === "email_informal" || t === "short_message") return "informal";
  return "neutral";
}

type WordTarget = { min: number; max: number; target: number };

export function getWordTarget(level: CefrLevel, type: TextType): WordTarget {
  const base: Record<CefrLevel, WordTarget> = {
    A2: { min: 180, max: 300, target: 240 },
    B1: { min: 250, max: 450, target: 350 },
    B2: { min: 400, max: 650, target: 520 },
    C1: { min: 650, max: 950, target: 800 },
    C2: { min: 900, max: 1300, target: 1100 },
  };

  const shortMessage: Record<CefrLevel, WordTarget> = {
    A2: { min: 40, max: 80, target: 60 },
    B1: { min: 60, max: 120, target: 90 },
    B2: { min: 80, max: 160, target: 120 },
    C1: { min: 120, max: 220, target: 170 },
    C2: { min: 140, max: 260, target: 200 },
  };

  const email: Record<CefrLevel, WordTarget> = {
    A2: { min: 120, max: 200, target: 160 },
    B1: { min: 160, max: 260, target: 210 },
    B2: { min: 200, max: 320, target: 260 },
    C1: { min: 250, max: 380, target: 310 },
    C2: { min: 280, max: 450, target: 360 },
  };

  if (type === "short_message") return shortMessage[level];
  if (type === "email_formal" || type === "email_informal") return email[level];

  return base[level];
}

export function cefrStyleGuide(level: CefrLevel): string {
  switch (level) {
    case "A2":
      return [
        "Language: high-frequency vocabulary, concrete topics.",
        "Grammar: mostly present simple, past simple; very limited subordination.",
        "Cohesion: basic linkers (and, but, because, then).",
        "Clarity: short sentences, explicit references.",
      ].join("\n");
    case "B1":
      return [
        "Language: everyday topics + some abstract ideas; controlled variety.",
        "Grammar: present perfect (basic), past continuous, modals (must/have to/should).",
        "Cohesion: wider linkers (however, although, so, as a result).",
        "Paragraphing: clear topic sentences.",
      ].join("\n");
    case "B2":
      return [
        "Language: more precise vocabulary; collocations where natural.",
        "Grammar: relative clauses, conditionals, passives (when needed), varied modals.",
        "Cohesion: argument flow, referencing, contrast/concession handled well.",
      ].join("\n");
    case "C1":
      return [
        "Language: nuanced tone, hedging, stance markers; idiomatic but not showy.",
        "Grammar: complex sentences with control; accurate referencing and cohesion.",
        "Discourse: clear rhetorical structure; subtle contrasts and concessions.",
      ].join("\n");
    case "C2":
      return [
        "Language: very precise and flexible; low-frequency lexis used naturally.",
        "Discourse: sophisticated organisation; rhetorical control and subtle tone shifts.",
        "Accuracy: near-native control without being unnatural or ‘thesaurusy’.",
      ].join("\n");
  }
}

export function cambridgeTextTypeSpec(type: TextType): string {
  switch (type) {
    case "story":
      return [
        "Format: Story with a clear beginning, development, and ending.",
        "Include: characters, setting, some action; optional dialogue.",
        "Tone: engaging and coherent; no headings required.",
      ].join("\n");
    case "short_message":
      return [
        "Format: Short message / note (like a text or quick note).",
        "Include: greeting optional; direct purpose; closing optional.",
        "Tone: informal and concise.",
      ].join("\n");
    case "email_informal":
      return [
        "Format: Informal email.",
        "Must include: Subject line; greeting (Hi…/Hello…); closing line; sign-off (Best, / See you,).",
        "Tone: friendly, informal; contractions allowed.",
      ].join("\n");
    case "email_formal":
      return [
        "Format: Formal email.",
        "Must include: Subject line; formal greeting (Dear … / Dear Sir or Madam,); polite closing; full name sign-off.",
        "Tone: formal; avoid slang; clear paragraphs; purpose stated early.",
      ].join("\n");
    case "article":
      return [
        "Format: Article for a magazine/blog/newsletter.",
        "Must include: title; clear paragraphing; optional subheadings.",
        "Tone: informative + engaging opening.",
      ].join("\n");
    case "review":
      return [
        "Format: Review (film/book/app/place).",
        "Must include: what it is; key features; opinion with reasons; recommendation.",
        "Optional: rating at the end (e.g., 4/5).",
      ].join("\n");
    case "report":
      return [
        "Format: Report (for a teacher/manager/committee).",
        "Must include: headings (e.g., Introduction, Findings, Recommendations).",
        "Tone: neutral/formal; evidence-focused; bullet points allowed.",
      ].join("\n");
    case "essay":
      return [
        "Format: Discursive essay.",
        "Must include: introduction with thesis; 2–3 body paragraphs with balanced points; conclusion.",
        "Tone: neutral/formal; logical connectors; avoid informal email language.",
      ].join("\n");
  }
}

export function buildCambridgeConstraints(level: CefrLevel, type: TextType): string {
  const wt = getWordTarget(level, type);
  const register = getRegisterForTextType(type);

  return [
    `CEFR level: ${level}`,
    `Text type: ${type}`,
    `Register: ${register}`,
    `Target length: ${wt.target} words (acceptable range: ${wt.min}–${wt.max})`,
    "",
    "Text-type requirements:",
    cambridgeTextTypeSpec(type),
    "",
    "Level style guide:",
    cefrStyleGuide(level),
    "",
    "Hard rules:",
    "- Keep the text within the target word range.",
    "- Make the format unmistakably match the text type.",
    "- Keep STANDARD and SUPPORTED aligned to ONE answer key (supports are additive only).",
  ].join("\n");
}
