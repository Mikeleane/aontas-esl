$ErrorActionPreference = "Stop"
$enc = New-Object System.Text.UTF8Encoding($false)

function ReadText($p){ Get-Content -LiteralPath $p -Raw }
function WriteText($p,$t){ [IO.File]::WriteAllText((Resolve-Path $p).Path,$t,$enc) }

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path (Resolve-Path ".").Path ".patch_backups\cefr_ui_$ts"
New-Item -ItemType Directory -Force $backupDir | Out-Null

function Backup($p){
  if(Test-Path $p){
    Copy-Item -LiteralPath $p -Destination (Join-Path $backupDir (Split-Path $p -Leaf)) -Force
  }
}

# ---------- ReadingStudio: add CEFR/TextType controls + send to API ----------
$studio = ".\app\_features\reading\ReadingStudio.tsx"
if(!(Test-Path $studio)){ throw "Missing $studio" }
Backup $studio
$t = ReadText $studio

if($t -notmatch 'CefrTextTypeControls'){
  if($t -match '"use client";'){
    $t = [regex]::Replace($t,'("use client";\s*\r?\n)','$1' + "import CefrTextTypeControls from `"../../_components/CefrTextTypeControls`";`r`n",1)
  } else {
    $t = "import CefrTextTypeControls from `"../../_components/CefrTextTypeControls`";`r`n" + $t
  }
}

if($t -notmatch '\[cefrLevel,\s*setCefrLevel\]'){
  $t = [regex]::Replace(
    $t,
    '(const\s+\[error,\s*setError\]\s*=\s*useState<[^>]+>\(""\);\s*\r?\n)',
    '$1' + "  const [cefrLevel, setCefrLevel] = useState<string>(`"B1`");`r`n  const [textType, setTextType] = useState<string>(`"article`");`r`n",
    1
  )
}

if($t -notmatch '<CefrTextTypeControls'){
  $t = [regex]::Replace(
    $t,
    '(\s*)<TeacherInputsPanel\s+onGenerate=\{generateFromInputs\}\s*\/>',
    '$1<div style={{ marginBottom: 12 }}>' + "`r`n" +
    '$1  <CefrTextTypeControls cefrLevel={cefrLevel} setCefrLevel={setCefrLevel} textType={textType} setTextType={setTextType} />' + "`r`n" +
    '$1</div>' + "`r`n" +
    '$1<TeacherInputsPanel onGenerate={generateFromInputs} />',
    1
  )
}

if($t -notmatch '\bcefrLevel\s*:'){
  $t = [regex]::Replace(
    $t,
    '(const\s+body\s*=\s*\{\s*\r?\n)',
    '$1' + "        cefrLevel,`r`n        level: cefrLevel,`r`n        textType,`r`n",
    1
  )
}

WriteText $studio $t
Write-Host "✅ Patched ReadingStudio.tsx" -ForegroundColor Green

# ---------- readingPackTypes: add cefrLevel/textType (optional fields) ----------
$types = ".\app\_features\reading\readingPackTypes.ts"
if(Test-Path $types){
  Backup $types
  $t = ReadText $types
  if($t -notmatch '\bcefrLevel\?:'){
    if($t -match 'title\s*\?:\s*string\s*;'){
      $t = [regex]::Replace(
        $t,
        '(title\s*\?:\s*string\s*;\s*\r?\n)',
        '$1' + "  cefrLevel?: string; // A2, B1, B2, C1, C2`r`n  textType?: string;  // story, email_formal, email_informal, short_message, report, review, article, essay`r`n",
        1
      )
    }
  }
  WriteText $types $t
  Write-Host "✅ Patched readingPackTypes.ts" -ForegroundColor Green
} else {
  Write-Host "⚠️ readingPackTypes.ts not found (skipped)" -ForegroundColor Yellow
}

# ---------- ReadingPackApp: FIX TDZ bug + update export tags + social-thread payload ----------
$app = ".\app\_features\reading\ReadingPackApp.tsx"
if(!(Test-Path $app)){ throw "Missing $app" }
Backup $app
$t = ReadText $app

# Remove the early useEffect that references socialSource before it's declared (TDZ crash)
$pattern = '(?s)\r?\n\s*useEffect\(\(\)\s*=>\s*\{.*?buildWordinessSeedFromText.*?wordiness_seed_json.*?\}\s*,\s*\[\]\s*\);\s*'
$t = [regex]::Replace($t, $pattern, "`r`n", 1)

# Replace filename tags class/stage -> cefr/type
$t = $t -replace 'withCrest\.schoolClass\s*\?\s*`class\$\{withCrest\.schoolClass\}`\s*:\s*null,', 'withCrest.cefrLevel ? `cefr${withCrest.cefrLevel}` : null,'
$t = $t -replace 'withCrest\.stage\s*\?\s*`stage\$\{withCrest\.stage\}`\s*:\s*null,', 'withCrest.textType ? `type${withCrest.textType}` : null,'

# Ensure social-thread request includes cefr/textType (if present in this file)
if($t -match '"/api/social-thread"' -and $t -notmatch 'textType:\s*\(pack'){
  $t = [regex]::Replace(
    $t,
    '("/api/social-thread"\s*,\s*\{\s*)',
    '$1' + 'cefrLevel: (pack as any)?.cefrLevel ?? "B1", textType: (pack as any)?.textType ?? "article", ',
    1
  )
}

WriteText $app $t
Write-Host "✅ Patched ReadingPackApp.tsx" -ForegroundColor Green

Write-Host ""
Write-Host ("✅ Backups: " + $backupDir) -ForegroundColor Cyan