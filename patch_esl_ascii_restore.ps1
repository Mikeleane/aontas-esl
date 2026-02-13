$ErrorActionPreference = "Stop"
$root = (Resolve-Path ".").Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $root ".patch_backups\esl_ascii_restore_$stamp"
New-Item -ItemType Directory -Force $backupDir | Out-Null

$utf8   = [Text.Encoding]::UTF8
$cp1252 = [Text.Encoding]::GetEncoding(1252)

function Write-Utf8NoBom([string]$FullPath, [string]$Content) {
  $dir = Split-Path $FullPath -Parent
  New-Item -ItemType Directory -Force $dir | Out-Null
  [System.IO.File]::WriteAllText($FullPath, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Fix-MojibakeToAscii([string]$s) {
  # Reverse common mojibake: UTF-8 bytes interpreted as CP1252 then saved.
  $bytes = $cp1252.GetBytes($s)
  $fixed = $utf8.GetString($bytes)

  # Normalize punctuation to ASCII
  $fixed = $fixed.Replace([char]0x2013, '-')   # en dash
  $fixed = $fixed.Replace([char]0x2014, '-')   # em dash
  $fixed = $fixed.Replace([string][char]0x2026, "...") # ellipsis
  $fixed = $fixed.Replace([char]0x2018, "'").Replace([char]0x2019, "'")
  $fixed = $fixed.Replace([char]0x201C, '"').Replace([char]0x201D, '"')
  $fixed = $fixed.Replace([char]0x00A0, ' ')   # NBSP
  $fixed = $fixed.Replace([string][char]0xFEFF, "")  # BOM char
  return $fixed
}

# --- A) Clean mojibake across TS/TSX ---
$files = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\\.next\\|\\\.patch_backups\\" }

foreach ($f in $files) {
  $full = $f.FullName
  $txt = [System.IO.File]::ReadAllText($full, [Text.Encoding]::UTF8)

  $hasMarker =
    ($txt.IndexOf([char]0x00E2) -ge 0) -or  # ÃƒÆ’Ã‚Â¢
    ($txt.IndexOf([char]0x00C3) -ge 0) -or  # ÃƒÆ’Ã†â€™
    ($txt.IndexOf([char]0x00C2) -ge 0)      # ÃƒÆ’Ã¢â‚¬Å¡

  if (-not $hasMarker) { continue }

  $new = Fix-MojibakeToAscii $txt
  if ($new -ne $txt) {
    $bak = Join-Path $backupDir ($f.Name + ".bak")
    Copy-Item -LiteralPath $full -Destination $bak -Force
    Write-Utf8NoBom $full $new
    Write-Host ("OK cleaned: " + $f.FullName.Substring($root.Length + 1)) -ForegroundColor Green
  }
}

# --- B) Fix Wordiness seeding in ReadingPackApp ---
$rpRel = "app\_features\reading\ReadingPackApp.tsx"
$rp = Join-Path $root $rpRel

if (Test-Path $rp) {
  $before = [System.IO.File]::ReadAllText($rp, [Text.Encoding]::UTF8)
  $t = $before

  # Remove any useEffect(...,[]) that writes wordiness_seed_json
  $rxRemove = New-Object System.Text.RegularExpressions.Regex(
    "(?s)\r?\n\s*useEffect\(\(\)\s*=>\s*\{[\s\S]*?localStorage\.setItem\(""wordiness_seed_json""[\s\S]*?\}\s*,\s*\[\s*\]\s*\)\s*;\s*\r?\n",
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  while ($rxRemove.IsMatch($t)) {
    $t = $rxRemove.Replace($t, "`r`n", 1)
  }

  if ($t -notmatch "Wordiness seed derived from the reading text") {

    $insert = @"
  // Wordiness seed derived from the reading text
  useEffect(() => {
    try {
      const p: any = pack;
      if (!p) return;

      const pick = (v: any) => (typeof v === "string" ? v : "");
      const src = socialSource === "SUPPORTED" ? "SUPPORTED" : "standard";

      const textForSeed =
        pick(p[`${src}Text`]) ||
        pick(p[`${src.toLowerCase()}Text`]) ||
        pick(p[src]) ||
        pick(p.text) ||
        pick(p.primaryText) ||
        pick(p.articleText) ||
        pick(p.passage) ||
        pick(p.content) ||
        "";

      if (!textForSeed.trim()) return;

      const seed = buildWordinessSeedFromText(textForSeed, "reading-pack");
      localStorage.setItem("wordiness_seed_json", JSON.stringify(seed));
    } catch {}
  }, [pack, socialSource]);

"@

    $anchor = New-Object System.Text.RegularExpressions.Regex(
      "(const\s+\[socialSource[^\r\n]*\);\s*)",
      [System.Text.RegularExpressions.RegexOptions]::None
    )

    if ($anchor.IsMatch($t)) {
      $t = $anchor.Replace($t, '$1' + "`r`n`r`n" + $insert, 1)
    } else {
      Write-Host "WARN: anchor for socialSource not found; did not insert Wordiness effect." -ForegroundColor Yellow
    }
  }

  if ($t -ne $before) {
    Copy-Item -LiteralPath $rp -Destination (Join-Path $backupDir "ReadingPackApp.tsx.bak") -Force
    Write-Utf8NoBom $rp $t
    Write-Host "OK patched ReadingPackApp wordiness seed logic" -ForegroundColor Green
  } else {
    Write-Host "No change ReadingPackApp (already ok or pattern not found)" -ForegroundColor Yellow
  }
} else {
  Write-Host "WARN: ReadingPackApp not found at $rpRel" -ForegroundColor Yellow
}

Write-Host ""
Write-Host ("Backups: " + $backupDir) -ForegroundColor Cyan
Write-Host "Done." -ForegroundColor Green