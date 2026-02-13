# Fix-WordinessHub-ShowAll.ps1
# PS 5.1 safe + StrictMode safe

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Get-PropValue([object]$Obj, [string]$Name) {
  if ($null -eq $Obj) { return $null }
  $p = $Obj.PSObject.Properties[$Name]
  if ($null -eq $p) { return $null }
  return $p.Value
}

$root = (Get-Location).Path
$pubDir = Join-Path $root "public\wordiness"
$manifestPath = Join-Path $pubDir "manifest.json"
$appPage = Join-Path $root "app\wordiness\page.tsx"
$readingApp = Join-Path $root "app\_features\reading\ReadingPackApp.tsx"

if (!(Test-Path $pubDir)) { throw "Missing folder: $pubDir" }

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bakDir = Join-Path $root ".wordiness_backups\hubfix_$stamp"
New-Item -ItemType Directory -Path $bakDir | Out-Null

if (Test-Path $manifestPath) { Copy-Item $manifestPath (Join-Path $bakDir "manifest.json") -Force }
if (Test-Path $appPage)      { Copy-Item $appPage      (Join-Path $bakDir "page.tsx") -Force }
if (Test-Path $readingApp)   { Copy-Item $readingApp   (Join-Path $bakDir "ReadingPackApp.tsx") -Force }

# Fix zero-byte Word Order Rails by redirecting to seeded version (keeps #seed=...)
$rails = Join-Path $pubDir "wordiness-word-order-rails.html"
$railsSeeded = "wordiness-word-order-rails-seeded.html"
if ((Test-Path $rails) -and ((Get-Item $rails).Length -eq 0)) {
  $stub = @"
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Word Order Rails</title>
  <script>
    (function(){
      var target = "$railsSeeded" + (location.hash || "");
      location.replace(target);
    })();
  </script>
</head>
<body>Redirecting...</body>
</html>
"@
  Write-Utf8NoBom $rails $stub
  Write-Host "Fixed: $($rails) (was 0 bytes)"
}

# Load old manifest (array OR {games:[...]}) if possible
$oldByFile = @{}
if (Test-Path $manifestPath) {
  try {
    $raw = Get-Content $manifestPath -Raw -Encoding UTF8
    $arr = $null
    if ($raw.Trim().StartsWith("[")) {
      $arr = $raw | ConvertFrom-Json
    } else {
      $obj = $raw | ConvertFrom-Json
      $arr = Get-PropValue $obj "games"
    }

    if ($arr) {
      foreach ($g in $arr) {
        $f = Get-PropValue $g "file"
        if ($f) { $oldByFile[$f] = $g }
      }
    }
  } catch {
    Write-Host "WARN: Could not parse existing manifest.json. Rebuilding from disk."
  }
}

function TitleFromFile([string]$file) {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($file)
  $name = $name -replace '^wordiness-',''
  $name = $name -replace '-seeded$',''
  $name = $name -replace '-',' '
  $parts = $name.Split(' ') | ForEach-Object {
    if ($_.Length -le 2) { $_.ToUpper() } else { $_.Substring(0,1).ToUpper() + $_.Substring(1) }
  }
  return ($parts -join ' ')
}

function TagsFromFile([string]$file) {
  $f = $file.ToLower()
  $tags = New-Object System.Collections.Generic.List[string]
  if ($f -match 'syllable') { $tags.Add('syllables') }
  if ($f -match 'morpheme') { $tags.Add('morphology') }
  if ($f -match 'stress')   { $tags.Add('pronunciation') }
  if ($f -match 'focus')    { $tags.Add('attention') }
  if ($f -match 'confus')   { $tags.Add('dyslexia') }
  if ($f -match 'order')    { $tags.Add('word-order') }
  if ($f -match 'connector'){ $tags.Add('connectors') }
  if ($f -match 'wh-question') { $tags.Add('questions') }
  if ($f -match 'start-stop'){ $tags.Add('fluency') }
  if ($f -match 'memory')   { $tags.Add('working-memory') }
  if ($f -match 'parts-of-speech|sentence-builder'){ $tags.Add('grammar') }
  if ($f -match 'seeded')   { $tags.Add('seeded') }
  return ($tags | Select-Object -Unique)
}

$files = Get-ChildItem $pubDir -File | Where-Object { $_.Extension -in ".html",".htm" } | Sort-Object Name

$new = @()
$order = 100

foreach ($fi in $files) {
  $file = $fi.Name

  # hide legacy/dupes
  if ($file.StartsWith("_")) { continue }

  $seedable = $false
  if ($file.ToLower() -match 'seeded\.(html|htm)$') { $seedable = $true }

  if ($oldByFile.ContainsKey($file)) {
    $g = $oldByFile[$file]

    $title = (Get-PropValue $g "title")
    if (-not $title) { $title = (Get-PropValue $g "name") }
    if (-not $title) { $title = (TitleFromFile $file) }

    $desc = (Get-PropValue $g "desc")
    if (-not $desc) { $desc = (Get-PropValue $g "description") }
    if (-not $desc) { $desc = "" }

    $tags = (Get-PropValue $g "tags")
    if (-not $tags) { $tags = (TagsFromFile $file) }

    $seedable2 = (Get-PropValue $g "seedable")
    if ($seedable2 -ne $null) { $seedable = [bool]$seedable2 }

    $ord = (Get-PropValue $g "order")
    $ordInt = $null
    if ($ord -ne $null -and [int]::TryParse([string]$ord, [ref]$ordInt)) { $order = $ordInt }

    $new += [pscustomobject]@{
      file = $file
      title = $title
      desc = $desc
      tags = $tags
      seedable = $seedable
      order = $order
    }
  } else {
    $new += [pscustomobject]@{
      file = $file
      title = (TitleFromFile $file)
      desc = ""
      tags = (TagsFromFile $file)
      seedable = $seedable
      order = $order
    }
  }

  $order += 5
}

$new = $new | Sort-Object order, title
$json = $new | ConvertTo-Json -Depth 6
Write-Utf8NoBom $manifestPath $json
Write-Host ("Rebuilt manifest.json with {0} entries" -f $new.Count)

# Rewrite /wordiness hub page to show ALL games
$pageTsx = @'
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { buildWordinessSeedFromText } from "../_features/wordiness/buildWordinessSeed";

type Game = {
  file: string;
  title?: string;
  desc?: string;
  description?: string;
  tags?: string[];
  seedable?: boolean;
  order?: number;
};

function b64UrlEncodeUtf8(s: string) {
  const bytes = encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );
  const b64 = btoa(bytes);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default function WordinessHubPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [seedText, setSeedText] = useState("");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");

  useEffect(() => {
    fetch("/wordiness/manifest.json?ts=" + Date.now())
      .then((r) => r.json())
      .then((data) => {
        const arr: Game[] = Array.isArray(data) ? data : (data?.games ?? []);
        setGames(arr || []);
      })
      .catch(() => setGames([]));
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const g of games) (g.tags || []).forEach((t) => s.add(String(t)));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [games]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (games || [])
      .filter((g) => g && g.file)
      .filter((g) => (tag ? (g.tags || []).includes(tag) : true))
      .filter((g) => {
        if (!qq) return true;
        const hay = `${g.title || ""} ${g.file} ${(g.desc || g.description || "")} ${(g.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  }, [games, q, tag]);

  const seedHash = useMemo(() => {
    if (!seedText.trim()) return "";
    try {
      const seedObj = buildWordinessSeedFromText(seedText);
      return "#seed=" + b64UrlEncodeUtf8(JSON.stringify(seedObj));
    } catch {
      return "#seed=" + b64UrlEncodeUtf8(JSON.stringify({ seedText }));
    }
  }, [seedText]);

  function launch(g: Game) {
    const isSeededFile = /seeded\.(html|htm)$/i.test(g.file);
    const wantsSeed = !!g.seedable || isSeededFile;
    const url = "/wordiness/" + g.file + (wantsSeed ? seedHash : "");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ minHeight: "100vh", padding: 18, background: "linear-gradient(135deg, #dff1ff 0%, #fff5d6 100%)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <img src="/wordiness/crest.png" alt="crest" style={{ width: 46, height: 46, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Wordiness Hub</div>
            <div style={{ opacity: 0.75, fontSize: 13 }}>Launch Wordiness games. Seeded games use your Reading Pack text.</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
            Files found: <b>{games.length}</b>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 14, boxShadow: "0 10px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Current seed</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
            Paste Reading Pack text here (optional). Seeded games open with #seed=... attached.
          </div>
          <textarea
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            placeholder="Paste text from Reading Pack (optional)..."
            style={{ width: "100%", minHeight: 110, borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", padding: 10, fontSize: 14, lineHeight: 1.35 }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search games..."
              style={{ flex: "1 1 260px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.15)", padding: "10px 12px" }}
            />
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              style={{ flex: "0 0 220px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.15)", padding: "10px 12px" }}
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={() => setSeedText("")}
              style={{ borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", padding: "10px 14px", background: "white", cursor: "pointer" }}
            >
              Clear seed
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 14 }}>
          {filtered.map((g) => (
            <div key={g.file} style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: 14, boxShadow: "0 10px 22px rgba(0,0,0,0.05)" }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{g.title || g.file}</div>
              <div style={{ fontSize: 12, opacity: 0.75, minHeight: 32 }}>{g.desc || g.description || ""}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {(g.tags || []).slice(0, 8).map((t) => (
                  <span key={t} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 999, background: "rgba(0,0,0,0.06)" }}>{t}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                <button onClick={() => launch(g)} style={{ borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", padding: "10px 14px", background: "white", cursor: "pointer" }}>
                  Launch
                </button>
                <div style={{ fontSize: 11, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.file}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>Seeded games read a #seed=... hash.</div>
      </div>
    </div>
  );
}
'@
Write-Utf8NoBom $appPage $pageTsx
Write-Host "Rewrote app/wordiness/page.tsx"

# Fix duplicate import in ReadingPackApp.tsx if present
if (Test-Path $readingApp) {
  $txt = Get-Content $readingApp -Raw -Encoding UTF8
  $needle = 'import { buildWordinessSeedFromText } from "../wordiness/buildWordinessSeed";'
  $m = [regex]::Matches($txt, [regex]::Escape($needle))
  if ($m.Count -gt 1) {
    $first = $txt.IndexOf($needle)
    $before = $txt.Substring(0, $first + $needle.Length)
    $after = $txt.Substring($first + $needle.Length)
    $after = $after -replace "(\r?\n)\s*" + [regex]::Escape($needle), ""
    Write-Utf8NoBom $readingApp ($before + $after)
    Write-Host "Patched duplicate import in ReadingPackApp.tsx"
  }
}

Write-Host ""
Write-Host "DONE."
Write-Host ("Backup: {0}" -f $bakDir)
Write-Host "Next:"
Write-Host "  npm run dev"
Write-Host "  open http://localhost:3000/wordiness"
