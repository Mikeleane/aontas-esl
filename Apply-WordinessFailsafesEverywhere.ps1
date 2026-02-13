Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

$pubDir = Join-Path $PWD "public\wordiness"
if (!(Test-Path $pubDir)) { throw "Missing folder: $pubDir" }

# Crest sanity (optional)
$crestNoExt = Join-Path $pubDir "crest"
$crestPng   = Join-Path $pubDir "crest.png"

if ((Test-Path $crestNoExt) -and (-not (Test-Path $crestPng))) {
  Rename-Item -Path $crestNoExt -NewName "crest.png" -Force
  Write-Host "✅ Renamed crest -> crest.png"
}


$patch = @'
<!-- WORDINESS_FAILSAFE_PATCH v1 -->
<script id="wordiness-failsafe-patch">
(function(){
  if (window.__wordinessFailsafePatch) return;
  window.__wordinessFailsafePatch = true;

  const VOWEL = /[aeiouy]/i;

  const EXCEPTIONS = {
    different:   { spelling:["dif","fer","ent"], spoken:[["dif","frent"],["dif","rent"]] },
    vegetable:   { spelling:["ve","ge","ta","ble"], spoken:[["veg","ta","ble"],["vej","ta","bul"]] },
    factory:     { spelling:["fac","to","ry"], spoken:[["fac","tuh","ree"],["fac","tri"]] },
    family:      { spelling:["fam","i","ly"], spoken:[["fam","ly"]] },
    chocolate:   { spelling:["choc","o","late"], spoken:[["choc","late"]] },
    camera:      { spelling:["cam","er","a"], spoken:[["cam","ra"]] },
    interesting: { spelling:["in","ter","est","ing"], spoken:[["in","tres","ting"]] },
    probably:    { spelling:["prob","a","bly"], spoken:[["prob","ly"]] }
  };

  function hasVowelLetters(s){ return VOWEL.test(String(s||"")); }
  function lettersSpaced(s){ return String(s||"").split("").join(" "); }
  function onlyLetters(s){ return String(s||"").toLowerCase().replace(/[^a-z']/g,""); }

  function normalizeLine(s){
    return String(s||"")
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
      .replace(/\u00B7/g, "·")
      .trim();
  }

  function sanitizeSeedText(raw){
    raw = String(raw||"").replace(/\r/g,"");
    const out = [];
    for (const line0 of raw.split("\n")) {
      const line = normalizeLine(line0);
      if (!line) continue;

      if (/[-·]/.test(line) && !/\s/.test(line)) { out.push(line); continue; }

      const toks = line.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g);
      if (!toks) continue;
      for (const w of toks) {
        if (w.length > 28) continue;
        if (!hasVowelLetters(w)) continue;
        out.push(w);
      }
    }
    const seen = new Set();
    const final = [];
    for (const w of out) {
      const k = w.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      final.push(w);
    }
    return final.join("\n");
  }

  function replaceLine(text, lineIndex, newChunks){
    const lines = String(text||"").replace(/\r/g,"").split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return text;
    lines[lineIndex] = newChunks.join("-");
    return lines.join("\n");
  }

  function findSeedTextarea(){
    return document.querySelector("textarea#input, textarea#seed, textarea[data-seed], textarea");
  }

  function attachHelperUI(ta){
    if (!ta || ta.__wordinessHelperAttached) return;
    ta.__wordinessHelperAttached = true;

    const host = document.createElement("div");
    host.style.cssText = "margin-top:10px;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px 12px;background:rgba(0,0,0,.10);color:rgba(238,242,255,.85);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px";

    host.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
        <b>Wordiness helpers</b>
        <span style="opacity:.8">failsafes + disappearing-vowel options</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button type="button" id="wnzSan" style="cursor:pointer;border-radius:999px;padding:8px 10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:rgba(238,242,255,.92);font-weight:700;">Sanitize pasted text → words</button>
      </div>
      <div id="wnzMsg" style="margin-top:10px;opacity:.9;"></div>
      <div id="wnzSug" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"></div>
    `;

    ta.insertAdjacentElement("afterend", host);

    const msg = host.querySelector("#wnzMsg");
    const sug = host.querySelector("#wnzSug");
    const sanBtn = host.querySelector("#wnzSan");

    function refresh(){
      const raw = String(ta.value||"");
      const lines = raw.replace(/\r/g,"").split("\n").map(normalizeLine);
      sug.innerHTML = "";

      let warnCount = 0;
      for (const ln of lines) {
        if (!ln) continue;
        if (/[-·]/.test(ln) && !/\s/.test(ln)) {
          const parts = ln.split(/[-·]+/).map(s=>s.trim()).filter(Boolean);
          const bad = parts.filter(p=>!hasVowelLetters(p));
          if (bad.length) warnCount++;
        }
      }

      const found = [];
      lines.forEach((ln, i)=>{
        if (!ln) return;
        const key = onlyLetters(ln.replace(/[-·]/g,""));
        if (EXCEPTIONS[key]) found.push({ key, i });
      });

      msg.innerHTML =
        `${warnCount ? `<span style="color:#f59e0b;font-weight:800">${warnCount} warning(s)</span> (chunk has no vowel letters). ` : `<span style="color:#22c55e;font-weight:800">No failsafe warnings</span>. `}
         ${found.length ? `Found <b>${found.length}</b> reduction word(s).` : `No reduction words detected in list.`}`;

      found.slice(0, 12).forEach(({key, i})=>{
        const ex = EXCEPTIONS[key];
        const makeBtn = (label, chunks) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = `${key}: ${label}`;
          b.style.cssText = "cursor:pointer;border-radius:999px;padding:8px 10px;border:1px solid rgba(56,189,248,.28);background:rgba(56,189,248,.08);color:rgba(238,242,255,.92);font-weight:800;";
          b.onclick = ()=>{
            ta.value = replaceLine(ta.value, i, chunks);
            ta.dispatchEvent(new Event("input", { bubbles:true }));
          };
          return b;
        };
        if (ex.spelling) sug.appendChild(makeBtn("Use spelling", ex.spelling));
        if (Array.isArray(ex.spoken)) ex.spoken.forEach(opt => sug.appendChild(makeBtn("Use spoken", opt)));
      });
    }

    sanBtn.onclick = ()=>{
      const before = ta.value;
      const after = sanitizeSeedText(before);
      if (after && after !== before) {
        ta.value = after;
        ta.dispatchEvent(new Event("input", { bubbles:true }));
      }
    };

    let t=null;
    ta.addEventListener("input", ()=>{ clearTimeout(t); t=setTimeout(refresh, 120); });
    refresh();
  }

  function wrapSpeak(fnName){
    const old = window[fnName];
    if (typeof old !== "function") return;
    if (old.__wordinessWrapped) return;
    function wrapped(text, ...rest){
      const t = String(text||"").trim();
      if (t && !hasVowelLetters(t) && t.length <= 8) return old.call(this, lettersSpaced(t), ...rest);
      return old.call(this, text, ...rest);
    }
    wrapped.__wordinessWrapped = true;
    window[fnName] = wrapped;
  }
  ["speakNow","speak","speakText","say"].forEach(wrapSpeak);

  function patchSeedFromHash(){
    if (!/seed=/.test(String(location.hash||""))) return;
    const ta = findSeedTextarea();
    if (!ta) return;
    const before = ta.value;
    const after = sanitizeSeedText(before);
    if (after && after !== before) {
      ta.value = after;
      ta.dispatchEvent(new Event("input", { bubbles:true }));
    }
  }

  function boot(){
    const ta = findSeedTextarea();
    if (ta) attachHelperUI(ta);
    patchSeedFromHash();
  }

  window.addEventListener("hashchange", ()=>setTimeout(patchSeedFromHash, 0));
  setTimeout(boot, 80);
})();
</script>
<!-- /WORDINESS_FAILSAFE_PATCH v1 -->
'@

$targets = Get-ChildItem -Path $pubDir -Recurse -File -Include *.html,*.htm
Write-Host "Found $($targets.Count) html/htm file(s) under public/wordiness"

$changed = 0
foreach ($f in $targets) {
  $p = $f.FullName
  $raw = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)

  if ($raw -match 'id="wordiness-failsafe-patch"') { continue }

  if ($raw -match '(?i)</body\s*>' ) {
    $new = [regex]::Replace($raw, '(?i)(</body\s*>)', ($patch + "`r`n`$1"), 1)
    Write-Utf8NoBom $p $new
    $changed++
    Write-Host "✅ Patched: $($f.Name)"
    continue
  }

  if ($raw -match '(?i)</html\s*>' ) {
    $new = [regex]::Replace($raw, '(?i)(</html\s*>)', ($patch + "`r`n`$1"), 1)
    Write-Utf8NoBom $p $new
    $changed++
    Write-Host "✅ Patched (no </body>): $($f.Name)"
    continue
  }

  # last resort: append
  Write-Utf8NoBom $p ($raw + "`r`n" + $patch + "`r`n")
  $changed++
  Write-Host "✅ Patched (appended): $($f.Name)"
}

Write-Host ""
Write-Host "Done. Patched $changed file(s)."
Write-Host "Next: npm run dev -> open /wordiness -> test a few games."

