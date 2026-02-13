# Add-WordinessOutputs.ps1
# Adds Wordiness HTML templates to /public and creates a /wordiness hub route with "Open" + "Download seeded HTML".

$ErrorActionPreference = "Stop"

# --- CHANGE THIS if your repo lives elsewhere ---
$Repo = "C:\Users\mikel\OneDrive\Documents\GitHub\kns-aontas"

# --- SOURCE FILES (where you saved the fixed templates) ---
$Downloads = Join-Path $env:USERPROFILE "Downloads"
$SyllableSrc = Join-Path $Downloads "wordiness-syllable-tiles-fixed4.html"
$MorphemeSrc = Join-Path $Downloads "wordiness-morpheme-lego.html"   # optional

# --- Helper: write UTF-8 (no BOM) ---
function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path (Split-Path $Path -Parent) | Out-String).Trim() + "\" + (Split-Path $Path -Leaf), $Text, $enc)
}
function Ensure-Dir([string]$Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

if (!(Test-Path $Repo)) { throw "Repo not found: $Repo" }
if (!(Test-Path $SyllableSrc)) { throw "Missing source HTML: $SyllableSrc`nPut wordiness-syllable-tiles-fixed4.html in Downloads (or edit $SyllableSrc)." }

# --- Decide whether this repo uses /src/app or /app ---
$appRoot = if (Test-Path (Join-Path $Repo "src\app")) { Join-Path $Repo "src\app" } else { Join-Path $Repo "app" }
if (!(Test-Path $appRoot)) { throw "Could not find app router folder at $appRoot" }

# --- Copy templates into /public/wordiness ---
$publicWordiness = Join-Path $Repo "public\wordiness"
Ensure-Dir $publicWordiness

$SyllableDest = Join-Path $publicWordiness "syllable-tiles.html"
Copy-Item $SyllableSrc $SyllableDest -Force
Write-Host "Copied: $SyllableDest"

if (Test-Path $MorphemeSrc) {
  $MorphemeDest = Join-Path $publicWordiness "morpheme-lego.html"
  Copy-Item $MorphemeSrc $MorphemeDest -Force
  Write-Host "Copied: $MorphemeDest"
} else {
  Write-Host "Optional template not found (ok): $MorphemeSrc"
}

# --- Create /wordiness page ---
$wordinessDir = Join-Path $appRoot "wordiness"
Ensure-Dir $wordinessDir

$pagePath = Join-Path $wordinessDir "page.tsx"

$pageTsx = @"
'use client';

import React, { useMemo, useState } from "react";

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 400);
}

async function downloadSeededTemplate(opts: {
  templateUrl: string;
  filename: string;
  seedText: string;
}) {
  const res = await fetch(opts.templateUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch template: " + opts.templateUrl);
  let html = await res.text();

  // Inject a tiny script before </body> to prefill #input and auto-render.
  // This works even for offline exports (file://) because the seed is embedded in the file.
  const seedJson = JSON.stringify(opts.seedText || "");
  const inject = \`
<script>
(function(){
  try{
    var seed = \${seedJson};
    var ta = document.querySelector('#input');
    if(ta && seed && seed.trim()){
      ta.value = seed.replace(/\\r/g,'');
      // call render() if it exists
      if(typeof window.render === 'function') window.render();
      else if(typeof render === 'function') render();
    }
  }catch(e){}
})();
</script>
\`;

  if (html.includes("</body>")) html = html.replace("</body>", inject + "</body>");
  else html += inject;

  downloadTextFile(opts.filename, html);
}

export default function WordinessHub() {
  const [seed, setSeed] = useState(
    "re-spon-si-bi-li-ty\\n" +
    "in-for-ma-tion\\n" +
    "op-por-tu-ni-ty\\n" +
    "dif-fi-cult\\n" +
    "in-ter-est-ing\\n" +
    "a-ma-zing"
  );

  const seedHash = useMemo(() => {
    const s = seed.trim();
    return s ? "#seed=" + encodeURIComponent(s) : "";
  }, [seed]);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ margin: "6px 0 6px" }}>Wordiness</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>
        Class games for the <b>shapes</b> and <b>sounds</b> of words (dyslexia-friendly chunking + TTS).
      </p>

      <section style={{ marginTop: 16, border: "1px solid rgba(255,255,255,.14)", borderRadius: 14, padding: 14 }}>
        <h2 style={{ margin: "0 0 8px" }}>Syllable Tiles</h2>
        <p style={{ margin: "0 0 10px", opacity: 0.85 }}>
          One word per line. Mark syllables using <b>-</b> or <b>·</b> (e.g. <code>re-spon-si-bi-li-ty</code>).
        </p>

        <textarea
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          rows={7}
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", background: "rgba(0,0,0,.20)", color: "inherit" }}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <a
            href={"/wordiness/syllable-tiles.html" + seedHash}
            target="_blank"
            rel="noreferrer"
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", textDecoration: "none", color: "inherit" }}
          >
            Open (seed via URL)
          </a>

          <button
            onClick={() => downloadSeededTemplate({
              templateUrl: "/wordiness/syllable-tiles.html",
              filename: "wordiness-syllable-tiles.html",
              seedText: seed
            })}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(56,189,248,.40)", background: "rgba(56,189,248,.12)", color: "inherit" }}
          >
            Download seeded HTML
          </button>
        </div>

        <p style={{ marginTop: 10, opacity: 0.75 }}>
          “Open” uses the URL hash (fast, good for class display). “Download seeded” embeds the seed so it works offline.
        </p>
      </section>

      <section style={{ marginTop: 16, border: "1px solid rgba(255,255,255,.14)", borderRadius: 14, padding: 14 }}>
        <h2 style={{ margin: "0 0 8px" }}>Morpheme LEGO (optional)</h2>
        <p style={{ margin: "0 0 10px", opacity: 0.85 }}>
          Prefix + base + suffix snapping. (Only appears if you copied the template.)
        </p>
        <a
          href="/wordiness/morpheme-lego.html"
          target="_blank"
          rel="noreferrer"
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", textDecoration: "none", color: "inherit" }}
        >
          Open Morpheme LEGO
        </a>
      </section>
    </main>
  );
}
"@

Set-Content -Path $pagePath -Value $pageTsx -Encoding UTF8
Write-Host "Wrote: $pagePath"

# --- Patch syllable template to accept #seed=... automatically (so Open works) ---
$tpl = Get-Content $SyllableDest -Raw
if ($tpl -notmatch "applySeedFromHash") {
  $inject = @"
  // --- Seed from URL hash: #seed=... (URL-encoded) ---
  function applySeedFromHash(){
    try{
      const h = String(location.hash||"");
      const m = h.match(/(?:^#|&)seed=([^&]+)/);
      if(!m) return;
      const seed = decodeURIComponent(m[1]||"").replace(/\r/g,"");
      const ta = document.querySelector('#input');
      if(ta && seed.trim()){
        ta.value = seed;
        if(typeof window.render === 'function') window.render();
        else if(typeof render === 'function') render();
      }
    }catch(e){}
  }
  window.addEventListener('hashchange', applySeedFromHash);
  setTimeout(applySeedFromHash, 80);
"@
  # Insert just before the first refreshVoices() call.
  $tpl = $tpl -replace "refreshVoices\(\);", "$inject`nrefreshVoices();"
  Set-Content -Path $SyllableDest -Value $tpl -Encoding UTF8
  Write-Host "Patched template for #seed support: $SyllableDest"
} else {
  Write-Host "Template already patched for #seed support."
}

Write-Host ""
Write-Host "Done."
Write-Host "Run dev server:"
Write-Host "  cd `"$Repo`""
Write-Host "  npm run dev"
Write-Host "Then open: http://localhost:3000/wordiness"
