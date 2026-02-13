# Add-WordinessLab.ps1
$ErrorActionPreference = "Stop"

# --- Helper: write UTF-8 (no BOM) ---
function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  $dir = Split-Path $Path -Parent
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

$Repo = (Get-Location).Path
$PublicWordiness = Join-Path $Repo "public\wordiness"
if (!(Test-Path $PublicWordiness)) { throw "Missing folder: $PublicWordiness" }

# --- Find the latest uploaded lab file in Downloads ---
$Downloads = Join-Path $env:USERPROFILE "Downloads"
$src = Get-ChildItem $Downloads -File -Filter "wordiness-lab*.htm*" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (!$src) {
  throw "Couldn't find wordiness-lab*.htm* in Downloads. Put the file there, or set `$srcPath manually."
}

$destName = "wordiness-lab-shapes-sounds.html"
$destPath = Join-Path $PublicWordiness $destName

Copy-Item $src.FullName $destPath -Force
Write-Host "Copied:" $src.Name "-> public/wordiness/$destName"

# --- Patch crest path + TTS clipping ---
$html = Get-Content $destPath -Raw

# 1) Crest path: from 'crest.png' to '/wordiness/crest.png'
# (Your uploaded file uses crest.src = 'crest.png';) 
$html = $html -replace "crest\.src\s*=\s*'crest\.png'\s*;", "crest.src = '/wordiness/crest.png';"

# 2) TTS: add a tiny delay after cancel() before speak()
# Replace:
#   synth.cancel();
#   synth.speak(utter);
# With:
#   try{synth.cancel();}catch(e){}
#   setTimeout(()=>{ try{synth.speak(utter);}catch(e){} }, 60);
$pattern = [regex]::Escape("synth.cancel();") + "\s*" + [regex]::Escape("synth.speak(utter);")
$replacement = "try{synth.cancel();}catch(e){}" + "`n" + "        setTimeout(() => { try{synth.speak(utter);}catch(e){} }, 60);"
$html = [regex]::Replace($html, $pattern, $replacement)

Write-Utf8NoBom $destPath $html
Write-Host "Patched crest + TTS in:" $destName

# --- Try to ensure crest exists in public/wordiness ---
$crestCandidates = @(
  (Join-Path $Repo "public\crest.png"),
  (Join-Path $Repo "public\kns-crest.png"),
  (Join-Path $Repo "public\logo.png"),
  (Join-Path $Repo "public\wordiness\crest.png")
)

$crestSrc = $crestCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$crestDest = Join-Path $PublicWordiness "crest.png"

if ($crestSrc -and ($crestSrc -ne $crestDest)) {
  Copy-Item $crestSrc $crestDest -Force
  Write-Host "Copied crest:" (Split-Path $crestSrc -Leaf) "-> public/wordiness/crest.png"
} elseif (Test-Path $crestDest) {
  Write-Host "Crest already present: public/wordiness/crest.png"
} else {
  Write-Host "No crest found to copy (ok). The game will still work without it."
}

Write-Host ""
Write-Host "Done. Restart dev server if needed:"
Write-Host "  npm run dev"
Write-Host "Open:"
Write-Host "  http://localhost:3000/wordiness"
