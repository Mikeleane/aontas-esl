export type WordinessSeed = {
  seedText: string;
  sentences: string[];
  words: string[];
  structures?: {
    connectors?: { sentence: string; connector: string }[];
  };
  meta?: {
    createdAt: string;
    source?: string;
  };
};

function splitSentences(text: string): string[] {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const parts = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return parts
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/\s+/g, " "))
    .slice(0, 80);
}

function extractWords(text: string): string[] {
  const t = (text || "").toLowerCase();
  const m = t.match(/[a-z]+(?:'[a-z]+)?/g) || [];
  // de-dupe but keep order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of m) {
    if (!seen.has(w)) { seen.add(w); out.push(w); }
    if (out.length >= 250) break;
  }
  return out;
}

function extractConnectors(sentences: string[]) {
  const cs = ["because","but","so","when","if","although","then","and"];
  const out: { sentence: string; connector: string }[] = [];
  for (const s of sentences) {
    const low = s.toLowerCase();
    for (const c of cs) {
      if (low.includes(" " + c + " ")) {
        out.push({ sentence: s, connector: c });
        break;
      }
    }
    if (out.length >= 60) break;
  }
  return out;
}

export function buildWordinessSeedFromText(text: string, source?: string): WordinessSeed {
  const seedText = (text || "").replace(/\s+/g, " ").trim();
  const sentences = splitSentences(seedText);
  const words = extractWords(seedText);
  const connectors = extractConnectors(sentences);

  return {
    seedText,
    sentences,
    words,
    structures: { connectors },
    meta: { createdAt: new Date().toISOString(), source }
  };
}