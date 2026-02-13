# Apply-WordinessPolishEverywhere.ps1 (touch/tablet polish v4, safe + ASCII)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Read-Utf8([string]$Path) {
  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Replace-First([string]$text, [string]$pattern, [string]$replacement) {
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  return $rx.Replace($text, $replacement, 1)
}

function Inject-OnceBefore([string]$html, [string]$markerRegex, [string]$block, [string]$beforePattern) {
  if ([regex]::IsMatch($html, $markerRegex, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    return $html
  }
  $rx = [regex]::new($beforePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($rx.IsMatch($html)) {
    $repl = $block + "`r`n" + '$0'
    return $rx.Replace($html, $repl, 1)
  }
  return ($html + "`r`n" + $block)
}

$repo   = Get-Location
$pubDir = Join-Path $repo "public\wordiness"
if (!(Test-Path $pubDir)) { throw "Missing folder: $pubDir" }

$files = Get-ChildItem $pubDir -Recurse -File -Include *.html,*.htm
Write-Host ("Found {0} html/htm file(s) under public/wordiness" -f $files.Count)
if ($files.Count -eq 0) { exit 0 }

$stamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$bakDir = Join-Path $repo ".wordiness_backups\$stamp"
New-Item -ItemType Directory -Force -Path $bakDir | Out-Null
Write-Host ("Backup folder: {0}" -f $bakDir)

# Avoid duplicates across versions
$cssAnyVersionRegex = 'wordiness-ui-polish-v'
$jsAnyVersionRegex  = 'wordiness-touch-helpers-v'

$cssBlock = @'
<style>
/* wordiness-ui-polish-v4 */
:root{
  --tapMin: 44px;
  --safeBottom: env(safe-area-inset-bottom, 0px);
}
html, body{ height: 100%; }
body{
  min-height: 100dvh;
  padding-bottom: var(--safeBottom);
  -webkit-text-size-adjust: 100%;
  overscroll-behavior: contain;
}
@supports (height: 100svh){ body{ min-height: 100svh; } }

*{ -webkit-tap-highlight-color: transparent; }

button, [role="button"], a, input, select, textarea,
.tile, .wordCard, .slot, .badge{
  min-height: var(--tapMin);
}

button, [role="button"], a, .tile, .wordCard, .slot{
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

input, textarea, select{
  font-size: 16px !important; /* prevent iOS zoom */
}

[draggable="true"], .wordiness-draggable{
  touch-action: none; /* reduce scroll-vs-drag fighting */
}

.wordiness-drag-selected{
  outline: 3px solid rgba(56,189,248,.55) !important;
}

@media (prefers-reduced-motion: reduce){
  *{ scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
</style>
'@

$jsBlock = @'
<script>
// wordiness-touch-helpers-v4
(function(){
  try{
    var isCoarse=false;
    try{ isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches; }catch(e){}
    var isTouch = isCoarse || ("ontouchstart" in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints>0);

    // Crest fallback (works for /wordiness and file:// exports)
    var crest = document.getElementById("crest");
    if (crest && crest.tagName === "IMG") {
      crest.addEventListener("error", function(){ crest.src="/wordiness/crest.png"; }, { once:true });
    }

    if(!isTouch) return;

    var drags = Array.prototype.slice.call(document.querySelectorAll('[draggable="true"]'));
    if(!drags.length) return;

    drags.forEach(function(el){
      el.classList.add("wordiness-draggable");
      el.addEventListener("click", function(){
        drags.forEach(function(x){ x.classList.remove("wordiness-drag-selected"); });
        el.classList.add("wordiness-drag-selected");
      }, { passive:true });
    });

    var btn = document.createElement("button");
    btn.id="wordinessTouchToggle";
    btn.type="button";
    btn.style.position="fixed";
    btn.style.right="12px";
    btn.style.bottom="calc(12px + env(safe-area-inset-bottom, 0px))";
    btn.style.zIndex="9999";
    btn.style.border="1px solid rgba(255,255,255,.18)";
    btn.style.background="rgba(0,0,0,.45)";
    btn.style.color="rgba(238,242,255,.95)";
    btn.style.backdropFilter="blur(10px)";
    btn.style.borderRadius="999px";
    btn.style.padding="10px 12px";
    btn.style.font="600 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    btn.style.touchAction="manipulation";

    var dragEnabled=true;
    function applyState(){
      drags.forEach(function(el){ el.setAttribute("draggable", dragEnabled ? "true" : "false"); });
      btn.textContent = dragEnabled ? "Touch: Drag ON" : "Touch: Drag OFF";
    }
    btn.addEventListener("click", function(){ dragEnabled=!dragEnabled; applyState(); });

    document.body.appendChild(btn);
    applyState();
  }catch(e){}
})();
</script>
'@

$patched = 0

foreach ($f in $files) {
  $orig = Read-Utf8 $f.FullName
  $src  = $orig

  # backup
  $rel = $f.FullName.Substring($repo.Path.Length).TrimStart("\","/")
  $bakPath = Join-Path $bakDir $rel
  Write-Utf8NoBom $bakPath $orig

  # ensure viewport-fit=cover
  if ($src -match '(?i)<meta\s+name=["'']viewport["'']') {
    $src = Replace-First $src '(?i)<meta\s+name=["'']viewport["''][^>]*>' '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />'
  } else {
    $src = Replace-First $src '(?i)<head[^>]*>' ('$0' + "`r`n" + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />')
  }

  # inject CSS and JS (skip if any earlier version exists)
  $src = Inject-OnceBefore $src $cssAnyVersionRegex $cssBlock '</head>'
  $src = Inject-OnceBefore $src $jsAnyVersionRegex  $jsBlock  '</body>'

  if ($src -ne $orig) {
    Write-Utf8NoBom $f.FullName $src
    $patched++
    Write-Host ("Patched: {0}" -f $f.Name)
  } else {
    Write-Host ("No change: {0}" -f $f.Name)
  }
}

Write-Host ""
Write-Host ("Done. Patched {0} file(s)." -f $patched)
Write-Host ("Backup saved to: {0}" -f $bakDir)
