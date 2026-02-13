Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

$repo   = $PWD
$pubDir = Join-Path $repo "public\wordiness"
if (!(Test-Path $pubDir)) { throw "Missing folder: $pubDir" }

$dstHtml = Join-Path $pubDir "wordiness-working-memory-relay.html"
if (!(Test-Path $dstHtml)) {
  throw "Missing HTML file: $dstHtml`nSave your HTML there first (public/wordiness/wordiness-working-memory-relay.html)."
}

$manifestPath = Join-Path $pubDir "manifest.json"
if (!(Test-Path $manifestPath)) { throw "manifest.json not found at $manifestPath" }

$manifestRaw = Get-Content $manifestPath -Raw -Encoding UTF8
$manifestObj = $manifestRaw | ConvertFrom-Json

# Find the array of items (either manifest is an array, or contains an array of items that have a 'file' property)
$items = $null
$itemsProp = $null

if ($manifestObj -is [System.Array]) {
  $items = $manifestObj
} else {
  foreach ($p in $manifestObj.PSObject.Properties) {
    if ($p.Value -is [System.Array]) {
      if ($p.Value.Count -eq 0) { continue }
      $first = $p.Value[0]
      if ($first -and ($first.PSObject.Properties.Name -contains "file")) {
        $items = $p.Value
        $itemsProp = $p.Name
        break
      }
    }
  }
}

if (-not $items) { throw "Could not find an items array with a 'file' field in manifest.json" }

$newItem = [pscustomobject]@{
  title       = "Working Memory Relay"
  description = "Memorise a word list, then rebuild it from tiles. Supported mode gives more time and fewer words."
  file        = "wordiness-working-memory-relay.html"
  tags        = @("executive-function","working-memory","dyslexia-friendly","tts")
  seedable    = $true
}

# Upsert by file
$found = $false
for ($i=0; $i -lt $items.Count; $i++){
  if ($items[$i].file -eq $newItem.file) {
    $items[$i] = $newItem
    $found = $true
    break
  }
}
if (-not $found) { $items = @($items + $newItem) }

# Write back
if ($manifestObj -is [System.Array]) {
  $outObj = $items
} else {
  $manifestObj | Add-Member -Force NoteProperty $itemsProp $items
  $outObj = $manifestObj
}

Write-Utf8NoBom $manifestPath ($outObj | ConvertTo-Json -Depth 12)
Write-Host "✅ Updated $manifestPath"
Write-Host "✅ HTML present: $dstHtml"
Write-Host ""
Write-Host "Next:"
Write-Host "  git add public/wordiness/manifest.json public/wordiness/wordiness-working-memory-relay.html"
Write-Host "  git commit -m ""Add Working Memory Relay wordiness game"""