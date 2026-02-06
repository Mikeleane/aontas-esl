import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type ManifestEntry = {
  file: string;
  title?: string;
  desc?: string;
  tags?: string[];
  seedable?: boolean;
  order?: number;
};

function titleFromFile(name: string) {
  const id = name.replace(/\.(html|htm)$/i, "").replace(/^wordiness-/, "");
  const words = id.split(/[-_]+/g).filter(Boolean);
  return words
    .map((w) => {
      const lw = w.toLowerCase();
      if (lw === "dj") return "DJ";
      if (lw === "tts") return "TTS";
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export async function GET() {
  const dir = path.join(process.cwd(), "public", "wordiness");
  const manifestFile = path.join(dir, "manifest.json");

  // List actual files on disk (source of truth)
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => /\.(html|htm)$/i.test(n))
    .filter((n) => !n.startsWith("_"))
    .sort((a, b) => a.localeCompare(b));

  // Read manifest if present
  let manifest: ManifestEntry[] = [];
  try {
    const raw = await readFile(manifestFile, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) manifest = parsed;
  } catch {
    // ok: manifest optional
  }

  const byFile = new Map<string, ManifestEntry>();
  for (const m of manifest) {
    if (m && typeof m.file === "string") byFile.set(m.file, m);
  }

  const items = files.map((name) => {
    const m = byFile.get(name);
    const id = name.replace(/\.(html|htm)$/i, "");
    return {
      name,
      href: "/wordiness/" + name,
      id,
      title: m?.title || titleFromFile(name),
      desc: m?.desc || "",
      tags: Array.isArray(m?.tags) ? m!.tags : [],
      seedable: !!m?.seedable,
      order: typeof m?.order === "number" ? m!.order : 9999,
    };
  });

  items.sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title));

  return NextResponse.json({ files: items });
}
