Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

# --- Paths ---
$root = $PWD.Path
$pubDir = Join-Path $root "public\wordiness"
$featDir = Join-Path $root "app\_features\wordiness"
$wordinessPage = Join-Path $root "app\wordiness\page.tsx"
$readingApp = Join-Path $root "app\_features\reading\ReadingPackApp.tsx"

New-Item -ItemType Directory -Path $pubDir -Force | Out-Null
New-Item -ItemType Directory -Path $featDir -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $wordinessPage) -Force | Out-Null

# --------------------------------------------------------------------
# 1) Seed bridge JS used by games in public/wordiness/*.html/*.htm
# --------------------------------------------------------------------
$seedBridge = @'
/* wordiness-seed-bridge.js (v1)
   Games can call: window.__WORDINESS_SEED_BRIDGE__.getSeed()
   Sources (in order):
   - URL hash: #seed=BASE64URL(JSON)
   - localStorage: wordiness_seed_json
*/
(function(){
  var KEY = "wordiness_seed_json";

  function parseJson(s){
    try { return JSON.parse(s); } catch(e){ return null; }
  }

  function fromHash(){
    try{
      var h = String(location.hash || "");
      var m = h.match(/seed=([^&]+)/i);
      if(!m) return null;
      var b64url = decodeURIComponent(m[1]);
      var b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      while(b64.length % 4) b64 += "=";
      var json = atob(b64);
      return parseJson(json);
    } catch(e){ return null; }
  }

  function fromLocal(){
    try { return parseJson(localStorage.getItem(KEY) || ""); } catch(e){ return null; }
  }

  function setSeed(seed){
    try { localStorage.setItem(KEY, JSON.stringify(seed || {})); } catch(e){}
  }

  function getSeed(){
    return fromHash() || fromLocal() || null;
  }

  window.__WORDINESS_SEED_BRIDGE__ = { KEY: KEY, getSeed: getSeed, setSeed: setSeed };
})();
'@
Write-Utf8NoBom (Join-Path $pubDir "wordiness-seed-bridge.js") $seedBridge

# --------------------------------------------------------------------
# 2) TS helper: build a sane "WordinessSeed" from any text
# --------------------------------------------------------------------
$seedTs = @'
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
'@
Write-Utf8NoBom (Join-Path $featDir "buildWordinessSeed.ts") $seedTs

# --------------------------------------------------------------------
# 3) Wordiness Hub page (seeded launcher + paste text)
#    Opens games in /public/wordiness/<file>#seed=...
# --------------------------------------------------------------------
$hubTsx = @'
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { buildWordinessSeedFromText, type WordinessSeed } from "../_features/wordiness/buildWordinessSeed";

type Game = { file: string; title: string; desc: string; tags: string[] };

const GAMES: Game[] = [
  { file: "syllable-tiles-smart.html", title: "Syllable Tiles (Smart)", desc: "Chunk + blend with helpful warnings.", tags: ["syllables","phonics","tts"] },
  { file: "wordiness-lab-shapes-sounds.html", title: "Shapes & Sounds Lab", desc: "Rhyme, syllables, and phonological play.", tags: ["phonology","rhyme","syllables"] },
  { file: "wordiness-calm-spell-lab.htm", title: "Calm Spell Lab", desc: "Low-pressure spelling with pacing.", tags: ["spelling","regulation"] },
  { file: "wordiness-focus-finder.htm", title: "Focus Finder", desc: "Gentle attention training with language.", tags: ["attention","executive-function"] },
  { file: "wordiness-morpheme-lego.htm", title: "Morpheme Lego", desc: "Build meaning from prefixes/roots/suffixes.", tags: ["morphology","meaning"] },
  { file: "wordiness-morpheme-mixer.htm", title: "Morpheme Mixer", desc: "Mix and match morphemes (fast mode).", tags: ["morphology","meaning"] },
  { file: "wordiness-word-stress-dj.htm", title: "Word Stress DJ", desc: "Feel stress patterns and rhythm.", tags: ["pronunciation","prosody"] },
  { file: "wordiness-word-stress-dj-remix.htm", title: "Word Stress DJ Remix", desc: "More patterns, more remixing.", tags: ["pronunciation","prosody"] },
  { file: "wordiness-word-order-rails.html", title: "Word Order Rails (Seeded)", desc: "Tap tiles to rebuild sentences in order.", tags: ["grammar","word-order","seeded"] },
  { file: "wordiness-connector-switchboard-seeded.html", title: "Connector Switchboard (Seeded)", desc: "Pick the best connector (because/but/so/etc).", tags: ["connectors","seeded"] },
  { file: "wordiness-wh-question-picker.html", title: "WH Question Picker (Seeded)", desc: "Match answers to Why/When/Where/Who/What.", tags: ["questions","seeded"] },
];

const KEY = "wordiness_seed_json";

function base64UrlFromUtf8(json: string) {
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default function WordinessHubPage() {
  const [seed, setSeed] = useState<WordinessSeed | null>(null);
  const [paste, setPaste] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSeed(JSON.parse(raw));
    } catch {}
  }, []);

  const seedSummary = useMemo(() => {
    if (!seed) return "No seed yet. Generate a Reading Pack or paste text here.";
    const sCount = seed.sentences?.length || 0;
    const wCount = seed.words?.length || 0;
    const src = seed.meta?.source ? ` (${seed.meta.source})` : "";
    return `Seed loaded${src}: ${sCount} sentences, ${wCount} unique words.`;
  }, [seed]);

  function saveSeedFromText(text: string, source: string) {
    const t = (text || "").trim();
    if (!t) return;
    const s = buildWordinessSeedFromText(t, source);
    localStorage.setItem(KEY, JSON.stringify(s));
    setSeed(s);
  }

  function launch(gameFile: string) {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      alert("No seed found. Generate a Reading Pack first, or paste text here.");
      return;
    }
    const seedParam = base64UrlFromUtf8(raw);
    window.open(`/wordiness/${gameFile}#seed=${encodeURIComponent(seedParam)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <img src="/crest.png" alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 22 }}>Wordiness Hub</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>Launch Wordiness games seeded from your Reading Pack (tablet-friendly, teacher-controlled).</div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, borderRadius: 16, border: "1px solid rgba(0,0,0,.12)", background: "rgba(0,0,0,.04)" }}>
        <div style={{ fontWeight: 800 }}>Current seed</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>{seedSummary}</div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Paste text to seed Wordiness (optional)</div>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Paste a paragraph / story / Reading Pack text here..."
            style={{ width: "100%", minHeight: 110, padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,.18)" }}
          />
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => saveSeedFromText(paste, "pasted")}
              style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,.22)", background: "white", fontWeight: 800 }}
            >
              Use pasted text
            </button>
            <button
              type="button"
              onClick={() => { setPaste(""); }}
              style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,.18)", background: "rgba(255,255,255,.6)" }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {GAMES.map(g => (
          <div key={g.file} style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(0,0,0,.12)", background: "white" }}>
            <div style={{ fontWeight: 950 }}>{g.title}</div>
            <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13, lineHeight: 1.35 }}>{g.desc}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {g.tags.map(t => (
                <span key={t} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 999, border: "1px solid rgba(0,0,0,.12)", opacity: 0.85 }}>
                  {t}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => launch(g.file)}
                style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,.22)", background: "rgba(0,0,0,.04)", fontWeight: 900 }}
              >
                Launch
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, opacity: 0.75, fontSize: 12, lineHeight: 1.4 }}>
        Note: For seeded play, each game should include <code>{'<script src="wordiness-seed-bridge.js"></script>'}</code> in its HTML.
      </div>
    </div>
  );
}
'@
Write-Utf8NoBom $wordinessPage $hubTsx

# --------------------------------------------------------------------
# 4) Patch ReadingPackApp.tsx:
#    - import buildWordinessSeedFromText
#    - add a useEffect that keeps localStorage.wordiness_seed_json updated
#    - add a simple fixed "Wordiness" button that opens /wordiness
# --------------------------------------------------------------------
if (Test-Path $readingApp) {
  $src = Get-Content $readingApp -Raw -Encoding UTF8

  # 4a) add import
  if ($src -notmatch "buildWordinessSeedFromText") {
    $imp = 'import { buildWordinessSeedFromText } from "../wordiness/buildWordinessSeed";'
    $src = [regex]::Replace($src, "(?m)^(import .+?;\s*)\r?\n(?!import )", "`$1`r`n$imp`r`n", 1)
  }

  # 4b) detect likely text state variable names
  $candidates = @()
  $m = [regex]::Matches($src, "const\s+\[\s*(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*,\s*set[A-Za-z0-9_]+\s*\]\s*=\s*useState", "IgnoreCase")
  foreach($x in $m){ $candidates += $x.Groups["name"].Value }

  function PickName($names, $pattern) {
    foreach($n in $names){ if($n -match $pattern){ return $n } }
    return $null
  }

  $std = PickName $candidates "standard"
  $adp = PickName $candidates "adapt|support"
  $inp = PickName $candidates "input|source|raw"

  if (-not $std) { $std = $inp }
  if (-not $adp) { $adp = $std }

  if ($std) {
    $seedEffect = @"
  // Wordiness: keep a seeded word pool in localStorage for the Wordiness Hub (/wordiness)
  useEffect(() => {
    try {
      const textForSeed = String(($std || $adp || "") ?? "");
      if (!textForSeed.trim()) return;
      const seed = buildWordinessSeedFromText(textForSeed, "reading-pack");
      localStorage.setItem("wordiness_seed_json", JSON.stringify(seed));
    } catch (e) {}
  }, [$std, $adp]);

"@

    if ($src -notmatch "Wordiness: keep a seeded word pool") {
      $src = [regex]::Replace($src, "(?m)^\s*return\s*\(", $seedEffect + "  return (", 1)
    }

    if ($src -notmatch "Open Wordiness Hub") {
      $btn = @'
      {/* Wordiness quick launch */}
      <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 9999 }}>
        <button
          type="button"
          onClick={() => window.open("/wordiness", "_blank", "noopener,noreferrer")}
          style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,.22)", background: "white", fontWeight: 900 }}
          aria-label="Open Wordiness Hub"
          title="Open Wordiness Hub"
        >
          Wordiness
        </button>
      </div>
'@
      $src = [regex]::Replace($src, "(return\s*\(\s*<[^>]+>\s*)", "`$1`r`n$btn`r`n", 1)
    }

    Write-Utf8NoBom $readingApp $src
    Write-Host "Patched: app/_features/reading/ReadingPackApp.tsx"
  } else {
    Write-Host "Note: Could not detect a text state variable in ReadingPackApp.tsx, so seed auto-sync was not added." -ForegroundColor Yellow
    Write-Host "You can still use /wordiness and paste text manually." -ForegroundColor Yellow
  }
} else {
  Write-Host "Note: ReadingPackApp.tsx not found at expected path. Skipped main UI patch." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done."
Write-Host "Next:"
Write-Host "  npm run dev"
Write-Host "  Generate a Reading Pack"
Write-Host "  Click the fixed Wordiness button (bottom-right)"
Write-Host "  Launch a game"
