import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type ManifestEntry = {
  file: string;
  title?: string;
  desc?: string;
  description?: string;
  tags?: string[];
  seedable?: boolean;
  order?: number;
};

function titleFromFile(name: string): string {
  return name
    .replace(/\.(html|htm)$/i, "")
    .replace(/^wordiness-/, "")
    .replace(/-seeded$/i, "")
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "dj") return "DJ";
      if (lower === "tts") return "TTS";
      if (lower === "wh") return "WH";
      if (lower === "lego") return "LEGO";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ")
    .replace(/\bPbdq\b/gi, "p/b/d/q")
    .replace(/\bStart Stop\b/gi, "Start–Stop")
    .replace(/\bWH Question\b/gi, "WH-Question");
}

function inferTags(name: string): string[] {
  const lower = name.toLowerCase();
  const tags = new Set<string>();
  const add = (match: string, ...values: string[]) => { if (lower.includes(match)) values.forEach((value) => tags.add(value)); };
  add("spell", "spelling");
  add("syllable", "syllables", "pronunciation");
  add("stress", "pronunciation");
  add("speech", "speaking", "pronunciation");
  add("karaoke", "fluency", "reading", "pronunciation");
  add("reader", "fluency", "reading");
  add("phrase", "fluency", "phrasing");
  add("chunk", "phrasing", "reading");
  add("mystery", "vocabulary");
  add("morpheme", "morphology", "vocabulary");
  add("connector", "connectors", "sentences");
  add("sentence", "grammar", "sentences");
  add("parts-of-speech", "grammar");
  add("word-order", "word-order", "sentences");
  add("question", "questions");
  add("focus", "attention");
  add("confus", "attention", "letter-recognition");
  add("memory", "working-memory");
  add("tiny-step", "executive-function");
  add("rule-switch", "grammar", "executive-function");
  if (/-seeded\.(html|htm)$/i.test(name)) tags.add("seeded");
  return Array.from(tags);
}

function inferredDescription(name: string, title: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("calm-speech")) return "Practise clear, calm spoken English with paced repetition.";
  if (lower.includes("karaoke-reader")) return "Read aloud with paced highlighting and fluency support.";
  if (lower.includes("mystery-words")) return "Use clues and context to uncover target vocabulary.";
  if (lower.includes("pace-phrase-reader")) return "Build fluency by reading useful phrases at a controlled pace.";
  if (lower.includes("phrase-chunker")) return "Break sentences into meaningful phrases for easier reading and speaking.";
  if (lower.includes("rule-switch")) return "Switch between language rules while keeping attention on accuracy.";
  return `${title}: focused language practice.`;
}

export async function GET() {
  const dir = path.join(process.cwd(), "public", "wordiness");
  const manifestFile = path.join(dir, "manifest.json");
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(html|htm)$/i.test(name))
    .filter((name) => !name.startsWith("_"))
    .sort((a, b) => a.localeCompare(b));

  let manifest: ManifestEntry[] = [];
  try {
    const parsed = JSON.parse(await readFile(manifestFile, "utf8"));
    if (Array.isArray(parsed)) manifest = parsed;
  } catch {
    // The live filesystem is authoritative; manifest metadata is optional.
  }

  const metadata = new Map<string, ManifestEntry>();
  manifest.forEach((item) => {
    if (item && typeof item.file === "string") metadata.set(item.file, item);
  });

  const items = files.map((file, index) => {
    const item = metadata.get(file);
    const title = item?.title?.trim() || titleFromFile(file);
    const manifestTags = Array.isArray(item?.tags) ? item.tags.filter(Boolean) : [];
    const tags = Array.from(new Set([...manifestTags, ...inferTags(file)]));
    return {
      file,
      title,
      desc: item?.desc?.trim() || item?.description?.trim() || inferredDescription(file, title),
      tags,
      seedable: Boolean(item?.seedable) || /-seeded\.(html|htm)$/i.test(file),
      order: typeof item?.order === "number" ? item.order : 10000 + index,
    };
  });

  items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return NextResponse.json({ schemaVersion: 2, source: "public/wordiness", fileCount: items.length, files: items });
}
