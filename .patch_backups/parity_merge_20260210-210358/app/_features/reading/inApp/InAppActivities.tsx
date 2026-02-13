"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ReadingMode, ReadingPackData } from "../readingPackTypes";

/** ---------- Stage profiles (keeps games aligned to curriculum stage) ---------- */
type StageProfile = {
  stage: number;
  label: string;
  focus: string[];
  sentenceCount: number;
  maxSentenceWords: number;
  clozeBlanks: number;
  vocabTargets: number;
};

const STAGE_PROFILES: Record<number, StageProfile> = {
  1: {
    stage: 1,
    label: "Stage 1 (Early reading / decoding)",
    focus: ["phonological awareness", "high-frequency words", "simple sequencing", "basic meaning"],
    sentenceCount: 3,
    maxSentenceWords: 10,
    clozeBlanks: 2,
    vocabTargets: 6,
  },
  2: {
    stage: 2,
    label: "Stage 2 (Developing fluency)",
    focus: ["fluency", "literal comprehension", "vocabulary building", "basic inference"],
    sentenceCount: 4,
    maxSentenceWords: 14,
    clozeBlanks: 3,
    vocabTargets: 8,
  },
  3: {
    stage: 3,
    label: "Stage 3 (Secure reading / comprehension)",
    focus: ["literal + inferential comprehension", "authorâ€™s craft", "vocabulary (tier 2/3)", "summarising"],
    sentenceCount: 5,
    maxSentenceWords: 18,
    clozeBlanks: 4,
    vocabTargets: 10,
  },
  4: {
    stage: 4,
    label: "Stage 4 (Upper primary / critical reading)",
    focus: ["inference + justification", "viewpoint/bias", "morphology (prefix/suffix/root)", "discipline vocabulary"],
    sentenceCount: 6,
    maxSentenceWords: 22,
    clozeBlanks: 5,
    vocabTargets: 12,
  },
};

function getProfile(stage?: number): StageProfile {
  const s = Number(stage || 3);
  return STAGE_PROFILES[s] || STAGE_PROFILES[3];
}

/** ---------- Text utils ---------- */
const STOPWORDS = new Set(
  [
    "the","a","an","and","or","but","so","to","of","in","on","at","for","with","from","into","as","by","about",
    "is","are","was","were","be","been","being","it","its","they","them","their","this","that","these","those",
    "he","she","his","her","you","your","i","we","our","us","my","me","not","no","yes","do","does","did","done",
    "have","has","had","will","would","can","could","should","may","might","must","there","here","then","than",
  ]
);

function splitSentences(txt: string): string[] {
  const t = String(txt || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  // basic sentence split (no lookbehind so it behaves in older parsers too)
  const out: string[] = [];
  let cur = "";
  for (const ch of t) {
    cur += ch;
    if (ch === "." || ch === "!" || ch === "?") {
      const s = cur.trim();
      if (s) out.push(s);
      cur = "";
    }
  }
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

function wordsOf(txt: string): string[] {
  return String(txt || "")
    .toLowerCase()
    .replace(/[^a-z0-9'\- ]+/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function countVowelGroups(word: string): number {
  const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const groups = w.match(/[aeiouy]+/g);
  const n = groups ? groups.length : 0;
  // tiny heuristic: silent-e adjustment
  if (w.endsWith("e") && n > 1) return n - 1;
  return Math.max(1, n);
}

const COMMON_PREFIXES = ["un","re","dis","mis","pre","non","over","under","sub","super","inter","trans","anti","auto"];
const COMMON_SUFFIXES = ["ing","ed","er","est","ly","ness","ment","tion","sion","able","ible","ful","less","ous","ise","ize","ship"];

function splitMorphology(word: string): { prefix?: string; root: string; suffix?: string } {
  const w = String(word || "").toLowerCase();
  if (!w) return { root: "" };

  let prefix = "";
  let suffix = "";

  const pref = COMMON_PREFIXES.find((p) => w.startsWith(p) && w.length > p.length + 2);
  if (pref) prefix = pref;

  const suff = COMMON_SUFFIXES.find((s) => w.endsWith(s) && w.length > s.length + 2);
  if (suff) suffix = suff;

  const root = w.slice(prefix.length, w.length - suffix.length);
  return { prefix: prefix || undefined, root: root || w, suffix: suffix || undefined };
}

/** ---------- Voice (read aloud) ---------- */
type VoiceChoice = "female" | "male";

function pickVoice(voices: SpeechSynthesisVoice[], choice: VoiceChoice): SpeechSynthesisVoice | null {
  if (!voices?.length) return null;
  const byName = (needle: string) => voices.find((v) => v.name.toLowerCase().includes(needle));
  // Heuristic hits on common systems
  const female =
    byName("female") || byName("zira") || byName("samantha") || byName("victoria") || byName("google uk english female") || null;
  const male =
    byName("male") || byName("david") || byName("mark") || byName("george") || byName("google uk english male") || null;

  return choice === "female" ? (female || voices[0]) : (male || voices[0]);
}

function speakText(text: string, voiceChoice: VoiceChoice, rate = 1, pitch = 1) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;

  synth.cancel();
  const utter = new SpeechSynthesisUtterance(String(text || "").trim());
  const voices = synth.getVoices ? synth.getVoices() : [];
  const v = pickVoice(voices, voiceChoice);
  if (v) utter.voice = v;
  utter.rate = rate;
  utter.pitch = pitch;
  synth.speak(utter);
}

/** ---------- Game generation (from pack text, stage-aligned) ---------- */
type GameKind = "word_order" | "cloze" | "syllable_clap" | "morphology";

type GameBase = { id: string; kind: GameKind; title: string; skill: string };
type WordOrderGame = GameBase & { kind: "word_order"; sentence: string; tokens: string[] };
type ClozeGame = GameBase & { kind: "cloze"; sentence: string; blanks: string[] };
type SyllableGame = GameBase & { kind: "syllable_clap"; word: string; approxSyllables: number };
type MorphGame = GameBase & { kind: "morphology"; word: string; split: { prefix?: string; root: string; suffix?: string } };

type AnyGame = WordOrderGame | ClozeGame | SyllableGame | MorphGame;

function buildGames(pack: ReadingPackData, profile: StageProfile): AnyGame[] {
  const txt = pack?.reading?.standard || pack?.reading?.SUPPORTED || "";
  const sentences = splitSentences(txt);

  const filtered = sentences
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => wordsOf(s).length <= profile.maxSentenceWords);

  const chosenSentences = (filtered.length ? filtered : sentences).slice(0, profile.sentenceCount);

  // vocab targets from frequency
  const freq = new Map<string, number>();
  for (const w of wordsOf(txt)) {
    if (w.length < 4) continue;
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const vocab = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, profile.vocabTargets);

  const games: AnyGame[] = [];

  // Word order: 2 sentences
  chosenSentences.slice(0, 2).forEach((s, i) => {
    const rawTokens = s.split(/\s+/).filter(Boolean);
    // Keep punctuation attached to tokens (simpler + matches teacher expectations)
    games.push({
      id: `wo_${i}`,
      kind: "word_order",
      title: `Sentence builder ${i + 1}`,
      skill: "Word order / syntax",
      sentence: s,
      tokens: rawTokens,
    });
  });

  // Cloze: 2 sentences (blank vocab-ish words that appear)
  chosenSentences.slice(0, 2).forEach((s, i) => {
    const ws = unique(wordsOf(s)).filter((w) => vocab.includes(w));
    const blanks = ws.slice(0, profile.clozeBlanks);
    if (!blanks.length) return;
    games.push({
      id: `cl_${i}`,
      kind: "cloze",
      title: `Cloze challenge ${i + 1}`,
      skill: "Vocabulary in context",
      sentence: s,
      blanks,
    });
  });

  // Syllable clap: 6â€“10 words
  vocab.slice(0, Math.min(10, Math.max(6, profile.vocabTargets - 2))).forEach((w, i) => {
    games.push({
      id: `sy_${i}`,
      kind: "syllable_clap",
      title: `Clap the syllables`,
      skill: "Syllables / phonological awareness",
      word: w,
      approxSyllables: countVowelGroups(w),
    });
  });

  // Morphology: show prefix/root/suffix where possible
  vocab.slice(0, Math.min(8, profile.vocabTargets)).forEach((w, i) => {
    const split = splitMorphology(w);
    games.push({
      id: `mo_${i}`,
      kind: "morphology",
      title: `Word builder (prefix / root / suffix)`,
      skill: "Morphology / word structure",
      word: w,
      split,
    });
  });

  return games;
}

/** ---------- UI components ---------- */

function SliderRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "170px 1fr 60px", gap: 10, alignItems: "center" }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>{props.label}</div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", textAlign: "right" }}>
        {props.value}
        {props.suffix || ""}
      </div>
    </label>
  );
}

function SectionCard(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid rgba(15,23,42,.14)", borderRadius: 18, padding: 12, background: "white" }}>
      <div style={{ fontWeight: 1000, color: "#0f172a" }}>{props.title}</div>
      {props.subtitle && <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{props.subtitle}</div>}
      <div style={{ marginTop: 10 }}>{props.children}</div>
    </div>
  );
}

function shuffle<T>(arr: T[], seed = 1): T[] {
  // deterministic-ish shuffle (stable results per session)
  const a = [...arr];
  let x = seed;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 1664525 + 1013904223) % 4294967296;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function WordOrderGameView(props: { game: WordOrderGame; supported: boolean; fontSizePx: number }) {
  const { game, supported } = props;
  const correct = game.tokens.join(" ").trim();

  const [pool, setPool] = useState<string[]>(() => shuffle(game.tokens, game.tokens.length));
  const [built, setBuilt] = useState<string[]>([]);
  const [msg, setMsg] = useState<string>("");

  function addToken(tok: string, i: number) {
    setPool((p) => p.filter((_, idx) => idx !== i));
    setBuilt((b) => [...b, tok]);
    setMsg("");
  }
  function undo() {
    const last = built[built.length - 1];
    if (!last) return;
    setBuilt((b) => b.slice(0, -1));
    setPool((p) => [...p, last]);
    setMsg("");
  }
  function reset() {
    setPool(shuffle(game.tokens, game.tokens.length));
    setBuilt([]);
    setMsg("");
  }
  function check() {
    const attempt = built.join(" ").trim();
    if (!attempt) return;
    setMsg(attempt === correct ? "âœ… Correct!" : "Not quite â€” tweak the order.");
  }

  // Supported mode: lock first token as a scaffold (same target, same answer)
  useEffect(() => {
    if (!supported) return;
    if (built.length === 0 && pool.length) {
      const first = game.tokens[0];
      const idx = pool.findIndex((t) => t === first);
      if (idx >= 0) addToken(pool[idx], idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" onClick={undo} style={miniBtnStyle}>
          Undo
        </button>
        <button type="button" onClick={reset} style={miniBtnStyle}>
          Reset
        </button>
        <button type="button" onClick={check} style={miniBtnStyleStrong}>
          Check
        </button>
      </div>

      <div style={{ padding: 10, borderRadius: 14, border: "1px solid rgba(15,23,42,.14)", background: "#f8fafc" }}>
        <div style={{ fontWeight: 900, fontSize: 12, color: "#475569", marginBottom: 6 }}>Build the sentence:</div>
        <div style={{ fontSize: props.fontSizePx, lineHeight: 1.6, minHeight: 40 }}>
          {built.length ? built.join(" ") : <span style={{ color: "#94a3b8" }}>Tap words belowâ€¦</span>}
        </div>
        {msg && <div style={{ marginTop: 8, fontWeight: 900, color: msg.startsWith("âœ…") ? "#16a34a" : "#b45309" }}>{msg}</div>}
      </div>

      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {pool.map((tok, i) => (
          <button
            key={`${tok}_${i}`}
            type="button"
            onClick={() => addToken(tok, i)}
            style={{
              border: "1px solid rgba(15,23,42,.14)",
              borderRadius: 999,
              padding: "8px 10px",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {tok}
          </button>
        ))}
      </div>

      {supported && (
        <div style={{ marginTop: 10, color: "#64748b", fontSize: 12 }}>
          Supported scaffold: first word placed for you â€” same sentence, same goal.
        </div>
      )}
    </div>
  );
}

function ClozeGameView(props: { game: ClozeGame; supported: boolean; fontSizePx: number }) {
  const { game, supported } = props;
  const blanks = game.blanks.map((b) => b.toLowerCase());
  const bank = shuffle([...game.blanks], game.blanks.length);

  const parts = useMemo(() => {
    // Create a display version where each blank is replaced with a token placeholder.
    // (Simple approach: replace the first occurrence, case-insensitive-ish)
    let s = game.sentence;
    const reps: { word: string; idx: number }[] = [];
    blanks.forEach((b, i) => {
      const low = s.toLowerCase();
      const at = low.indexOf(b);
      if (at >= 0) {
        reps.push({ word: game.blanks[i], idx: at });
        // replace the first occurrence with a marker that won't collide
        s = s.slice(0, at) + `[[BLANK_${i}]]` + s.slice(at + b.length);
      }
    });
    return { marked: s, blanks: game.blanks };
  }, [game.blanks, game.sentence, blanks]);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<string>("");

  function check() {
    const ok =
      parts.blanks.every((w, i) => String(answers[i] || "").trim().toLowerCase() === w.toLowerCase());
    setMsg(ok ? "âœ… Correct!" : "Not quite â€” check spelling or word choice.");
  }

  return (
    <div>
      {supported && (
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 14, border: "1px solid rgba(15,23,42,.14)", background: "#f8fafc" }}>
          <div style={{ fontWeight: 1000, fontSize: 12, color: "#475569", marginBottom: 6 }}>Word bank</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {bank.map((w, i) => (
              <span key={i} style={{ border: "1px solid rgba(15,23,42,.14)", borderRadius: 999, padding: "6px 10px", fontWeight: 900, fontSize: 12 }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: props.fontSizePx, lineHeight: 1.7 }}>
        {parts.marked.split(/(\[\[BLANK_\d+\]\])/g).map((chunk, idx) => {
          const m = chunk.match(/\[\[BLANK_(\d+)\]\]/);
          if (!m) return <span key={idx}>{chunk}</span>;
          const i = Number(m[1]);
          return (
            <span key={idx} style={{ display: "inline-block", margin: "0 6px" }}>
              {supported ? (
                <select
                  value={answers[i] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                  style={{ padding: "6px 8px", borderRadius: 10, border: "1px solid rgba(15,23,42,.14)", fontWeight: 900 }}
                >
                  <option value="">â€”</option>
                  {bank.map((w, k) => (
                    <option key={k} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={answers[i] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                  placeholder="â€¦"
                  style={{ width: 110, padding: "6px 8px", borderRadius: 10, border: "1px solid rgba(15,23,42,.14)", fontWeight: 900 }}
                />
              )}
            </span>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" onClick={check} style={miniBtnStyleStrong}>
          Check
        </button>
        {msg && <div style={{ fontWeight: 1000, color: msg.startsWith("âœ…") ? "#16a34a" : "#b45309", paddingTop: 8 }}>{msg}</div>}
      </div>

      <div style={{ marginTop: 10, color: "#64748b", fontSize: 12 }}>
        Supported = word bank + dropdowns. Standard = type your answers. Same blanks, same target.
      </div>
    </div>
  );
}

function SyllableGameView(props: { games: SyllableGame[]; fontSizePx: number; voice: VoiceChoice }) {
  const [idx, setIdx] = useState(0);
  const g = props.games[idx];

  const [attempt, setAttempt] = useState("");
  const [msg, setMsg] = useState("");

  if (!g) return null;

  function check() {
    // Teacher-facing: we accept â€œclose enoughâ€ and show an estimate (this is a support tool)
    const typed = attempt.split("-").map((x) => x.trim()).filter(Boolean).length;
    setMsg(typed ? `You typed ${typed}. Estimated syllables: ${g.approxSyllables}.` : `Estimated syllables: ${g.approxSyllables}.`);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" onClick={() => setIdx((n) => Math.max(0, n - 1))} style={miniBtnStyle}>
          Prev
        </button>
        <button type="button" onClick={() => setIdx((n) => Math.min(props.games.length - 1, n + 1))} style={miniBtnStyle}>
          Next
        </button>
        <button type="button" onClick={() => speakText(g.word, props.voice, 0.95, 1)} style={miniBtnStyleStrong}>
          ðŸ”Š Say word
        </button>
      </div>

      <div style={{ padding: 12, borderRadius: 16, border: "1px solid rgba(15,23,42,.14)", background: "#f8fafc" }}>
        <div style={{ fontWeight: 1000, color: "#0f172a", fontSize: props.fontSizePx + 4 }}>{g.word}</div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
          Clap it out. Type syllables separated by hyphens (e.g., fan-tas-tic).
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <input
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            placeholder="syll-a-bles"
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,.14)", fontWeight: 900, width: 220 }}
          />
          <button type="button" onClick={check} style={miniBtnStyleStrong}>
            Check estimate
          </button>
        </div>

        {msg && <div style={{ marginTop: 10, fontWeight: 900, color: "#475569" }}>{msg}</div>}
      </div>
    </div>
  );
}

function MorphologyGameView(props: { games: MorphGame[]; supported: boolean; fontSizePx: number; voice: VoiceChoice }) {
  const [idx, setIdx] = useState(0);
  const g = props.games[idx];
  const [prefix, setPrefix] = useState("");
  const [root, setRoot] = useState("");
  const [suffix, setSuffix] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!g) return;
    setPrefix("");
    setRoot("");
    setSuffix("");
    setMsg("");
    if (props.supported) {
      // scaffold: prefill the likely split, but still requires noticing + discussion
      setPrefix(g.split.prefix || "");
      setRoot(g.split.root || "");
      setSuffix(g.split.suffix || "");
    }
  }, [g, props.supported]);

  if (!g) return null;

  function check() {
    const correct =
      String(prefix || "").toLowerCase() === String(g.split.prefix || "").toLowerCase() &&
      String(root || "").toLowerCase() === String(g.split.root || "").toLowerCase() &&
      String(suffix || "").toLowerCase() === String(g.split.suffix || "").toLowerCase();
    setMsg(correct ? "âœ… Looks good." : "Close â€” try adjusting prefix/root/suffix.");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" onClick={() => setIdx((n) => Math.max(0, n - 1))} style={miniBtnStyle}>
          Prev
        </button>
        <button type="button" onClick={() => setIdx((n) => Math.min(props.games.length - 1, n + 1))} style={miniBtnStyle}>
          Next
        </button>
        <button type="button" onClick={() => speakText(g.word, props.voice, 0.95, 1)} style={miniBtnStyleStrong}>
          ðŸ”Š Say word
        </button>
      </div>

      <div style={{ padding: 12, borderRadius: 16, border: "1px solid rgba(15,23,42,.14)", background: "#f8fafc" }}>
        <div style={{ fontWeight: 1000, color: "#0f172a", fontSize: props.fontSizePx + 4 }}>{g.word}</div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
          Identify <b>prefix</b>, <b>root</b>, <b>suffix</b>. (Not every word has all three â€” thatâ€™s part of the fun.)
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
          <label style={fieldStyle}>
            <div style={fieldLabel}>Prefix</div>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="(optional)" style={fieldInput} />
          </label>
          <label style={fieldStyle}>
            <div style={fieldLabel}>Root</div>
            <input value={root} onChange={(e) => setRoot(e.target.value)} placeholder="root" style={fieldInput} />
          </label>
          <label style={fieldStyle}>
            <div style={fieldLabel}>Suffix</div>
            <input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="(optional)" style={fieldInput} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button type="button" onClick={check} style={miniBtnStyleStrong}>
            Check
          </button>
          {msg && <div style={{ fontWeight: 1000, color: msg.startsWith("âœ…") ? "#16a34a" : "#b45309", paddingTop: 8 }}>{msg}</div>}
        </div>

        <div style={{ marginTop: 10, color: "#64748b", fontSize: 12 }}>
          Supported scaffold: prefilled split to support discussion; same learning target.
        </div>
      </div>
    </div>
  );
}

const miniBtnStyle: React.CSSProperties = {
  border: "1px solid rgba(15,23,42,.14)",
  background: "white",
  borderRadius: 12,
  padding: "9px 12px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const miniBtnStyleStrong: React.CSSProperties = {
  ...miniBtnStyle,
  background: "#0f172a",
  color: "white",
};

const fieldStyle: React.CSSProperties = { border: "1px solid rgba(15,23,42,.12)", borderRadius: 14, padding: 10, background: "white" };
const fieldLabel: React.CSSProperties = { fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 };
const fieldInput: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,.14)", fontWeight: 900 };

function TeacherResources(props: { profile: StageProfile; pack: ReadingPackData }) {
  const title = props.pack?.title || "Reading Pack";
  const focuses = props.profile.focus;

  const quickPrompts = [
    "What is the main idea? Which sentence proves it?",
    "Find a word that tells you how someone feels. What makes you think that?",
    "What might happen next? Use evidence from the text.",
    "Which detail is most important? Why?",
    "Is there any bias or viewpoint? What clues show it?",
  ];

  const morphologyPrompts = [
    "Spot a prefix: what does it usually mean here?",
    "Change the suffix: how does the meaning or word class change?",
    "Find a root word inside a longer word.",
  ];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <SectionCard
        title={`Teacher resources â€” aligned to ${props.profile.label}`}
        subtitle={`Pack: ${title}`}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {focuses.map((f) => (
            <span key={f} style={{ border: "1px solid rgba(15,23,42,.14)", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900, color: "#0f172a", background: "#f1f5f9" }}>
              {f}
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Oral language prompts" subtitle="Quick discussion questions that match the stage focus">
        <ul style={{ margin: 0, paddingLeft: 18, color: "#0f172a", lineHeight: 1.6 }}>
          {quickPrompts.slice(0, props.profile.stage >= 4 ? 5 : 4).map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Word lab mini-lessons" subtitle="Short, teacher-friendly tasks (5â€“8 minutes)">
        <ul style={{ margin: 0, paddingLeft: 18, color: "#0f172a", lineHeight: 1.6 }}>
          <li>Clap syllables for 5 target words; sort into 1 / 2 / 3+ syllables.</li>
          <li>Prefix/root/suffix: build a meaning guess, then check in context.</li>
          {props.profile.stage >= 3 && <li>Tier 2/3 vocab: â€œreplace the wordâ€ with a near-synonym â€” what changes?</li>}
          {props.profile.stage >= 4 && <li>Stretch: quick etymology curiosity â€” where might this word come from? (Latin/Greek/Old French?)</li>}
        </ul>

        <div style={{ marginTop: 10, color: "#64748b", fontSize: 12 }}>
          Note: â€œetymologyâ€ here is for curiosity + motivation. Keep it light and optional.
        </div>
      </SectionCard>

      <SectionCard title="Morphology prompts" subtitle="Use with the Word Builder game">
        <ul style={{ margin: 0, paddingLeft: 18, color: "#0f172a", lineHeight: 1.6 }}>
          {morphologyPrompts.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

/** ---------- Main exported component ---------- */
export default function InAppActivities(props: { pack: ReadingPackData; mode: ReadingMode }) {
  const profile = useMemo(() => getProfile(props.pack?.stage), [props.pack?.stage]);

  // Typography controls (teacher requested)
  const [fontSizePx, setFontSizePx] = useState(18);
  const [lineHeight, setLineHeight] = useState(16); // stored as *10 for easy slider
  const [letterSpacing, setLetterSpacing] = useState(0); // px

  const supported = props.mode === "SUPPORTED";

  // Voice controls (male/female buttons)
  const [voiceChoice, setVoiceChoice] = useState<VoiceChoice>("female");

  // Ensure voices load (Chrome often lazy-loads)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.getVoices?.();
    const onChange = () => synth.getVoices?.();
    synth.addEventListener?.("voiceschanged", onChange);
    return () => synth.removeEventListener?.("voiceschanged", onChange);
  }, []);

  const games = useMemo(() => buildGames(props.pack, profile), [props.pack, profile]);

  const wordOrder = games.filter((g): g is WordOrderGame => g.kind === "word_order");
  const cloze = games.filter((g): g is ClozeGame => g.kind === "cloze");
  const syllables = games.filter((g): g is SyllableGame => g.kind === "syllable_clap");
  const morph = games.filter((g): g is MorphGame => g.kind === "morphology");

  const [tab, setTab] = useState<"games" | "resources">("games");
  const [gameTab, setGameTab] = useState<"word_order" | "cloze" | "syllables" | "morphology">("word_order");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <SectionCard title="In-app controls" subtitle="These affect the in-app reading + games (HTML exports later)">
        <div style={{ display: "grid", gap: 10 }}>
          <SliderRow label="Font size" value={fontSizePx} min={14} max={28} step={1} onChange={setFontSizePx} suffix="px" />
          <SliderRow label="Line spacing" value={lineHeight} min={12} max={22} step={1} onChange={setLineHeight} suffix="" />
          <SliderRow label="Letter spacing" value={letterSpacing} min={0} max={3} step={0.25} onChange={setLetterSpacing} suffix="px" />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Read aloud</div>
            <button type="button" onClick={() => setVoiceChoice("female")} style={voiceChoice === "female" ? miniBtnStyleStrong : miniBtnStyle}>
              Female voice
            </button>
            <button type="button" onClick={() => setVoiceChoice("male")} style={voiceChoice === "male" ? miniBtnStyleStrong : miniBtnStyle}>
              Male voice
            </button>
          </div>
        </div>
      </SectionCard>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setTab("games")} style={tab === "games" ? miniBtnStyleStrong : miniBtnStyle}>
          Games
        </button>
        <button type="button" onClick={() => setTab("resources")} style={tab === "resources" ? miniBtnStyleStrong : miniBtnStyle}>
          Teacher resources
        </button>
      </div>

      {tab === "resources" ? (
        <TeacherResources profile={profile} pack={props.pack} />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <SectionCard
            title={`Games â€” ${profile.label}`}
            subtitle={`Mode: ${supported ? "Supported (B)" : "Standard (A)"} â€¢ Same learning targets, supported adds scaffolds`}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setGameTab("word_order")} style={gameTab === "word_order" ? miniBtnStyleStrong : miniBtnStyle}>
                Word order
              </button>
              <button type="button" onClick={() => setGameTab("cloze")} style={gameTab === "cloze" ? miniBtnStyleStrong : miniBtnStyle}>
                Cloze
              </button>
              <button type="button" onClick={() => setGameTab("syllables")} style={gameTab === "syllables" ? miniBtnStyleStrong : miniBtnStyle}>
                Syllables
              </button>
              <button type="button" onClick={() => setGameTab("morphology")} style={gameTab === "morphology" ? miniBtnStyleStrong : miniBtnStyle}>
                Prefix/Root/Suffix
              </button>
            </div>
          </SectionCard>

          <div
            style={{
              border: "1px solid rgba(15,23,42,.14)",
              borderRadius: 22,
              padding: 14,
              background: "white",
              // apply typography controls
              fontSize: fontSizePx,
              lineHeight: lineHeight / 10,
              letterSpacing: `${letterSpacing}px`,
            }}
          >
            {gameTab === "word_order" && (
              <div style={{ display: "grid", gap: 14 }}>
                {wordOrder.map((g) => (
                  <SectionCard key={g.id} title={g.title} subtitle={g.skill}>
                    <WordOrderGameView game={g} supported={supported} fontSizePx={fontSizePx} />
                  </SectionCard>
                ))}
                {!wordOrder.length && <div style={{ color: "#64748b", fontSize: 13 }}>Not enough suitable sentences found for word order.</div>}
              </div>
            )}

            {gameTab === "cloze" && (
              <div style={{ display: "grid", gap: 14 }}>
                {cloze.map((g) => (
                  <SectionCard key={g.id} title={g.title} subtitle={g.skill}>
                    <ClozeGameView game={g} supported={supported} fontSizePx={fontSizePx} />
                  </SectionCard>
                ))}
                {!cloze.length && <div style={{ color: "#64748b", fontSize: 13 }}>No good cloze targets found yet (needs more text or richer vocab).</div>}
              </div>
            )}

            {gameTab === "syllables" && (
              <SectionCard title="Clap the syllables" subtitle="Bigger font in word lab + quick read aloud">
                <SyllableGameView games={syllables} fontSizePx={fontSizePx} voice={voiceChoice} />
              </SectionCard>
            )}

            {gameTab === "morphology" && (
              <SectionCard title="Word builder" subtitle="Prefix / root / suffix + meaning discussion">
                <MorphologyGameView games={morph} supported={supported} fontSizePx={fontSizePx} voice={voiceChoice} />
              </SectionCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


