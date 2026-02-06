# Aontas — UI panel lightening patch (non-destructive token swap)
# Run from repo root:  .\scripts\aontas_fix_ui_panels.ps1
# It will back up files into .\_patch_backups\ui_panels_<timestamp>

param(
  [string]$Root = (Get-Location).Path
)

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path $Path), $Text, $enc)
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bkDir = Join-Path $Root "_patch_backups\ui_panels_$stamp"
New-Item -ItemType Directory -Force -Path $bkDir | Out-Null

$targets = @(
  Join-Path $Root "app\_features\reading\ReadingPackApp.tsx",
  Join-Path $Root "app\page.tsx"
) | Where-Object { Test-Path $_ }

if (-not $targets) {
  Write-Host "No target files found (expected ReadingPackApp.tsx and/or app/page.tsx)." -ForegroundColor Yellow
  exit 1
}

$map = @(
  @{a="bg-slate-950/40"; b="bg-white"},
  @{a="bg-slate-950/60"; b="bg-white"},
  @{a="bg-slate-950"; b="bg-white"},
  @{a="bg-slate-900/60"; b="bg-white"},
  @{a="bg-slate-900/50"; b="bg-white"},
  @{a="bg-slate-900/40"; b="bg-white"},
  @{a="bg-slate-900"; b="bg-white"},
  @{a="bg-slate-800"; b="bg-white"},
  @{a="border-white/10"; b="border-slate-200"},
  @{a="border-slate-800"; b="border-slate-200"},
  @{a="border-slate-700"; b="border-slate-200"},
  @{a="bg-white/10"; b="bg-slate-50"},
  @{a="bg-white/5"; b="bg-slate-50"},
  @{a="hover:bg-slate-950/60"; b="hover:bg-slate-100"},
  @{a="hover:bg-white/15"; b="hover:bg-slate-100"},
  @{a="text-slate-50"; b="text-slate-900"},
  @{a="text-slate-100"; b="text-slate-900"},
  @{a="text-slate-200"; b="text-slate-700"},
  @{a="text-slate-300"; b="text-slate-600"},
  @{a="text-slate-400"; b="text-slate-500"},
  @{a="text-[#d7f3ff]"; b="text-slate-900"},
  @{a="text-[#dff5e6]"; b="text-slate-900"},
  @{a="text-[#ffe9a8]"; b="text-slate-900"}
)

foreach ($file in $targets) {
  Copy-Item -Force $file (Join-Path $bkDir ([IO.Path]::GetFileName($file)))
  $t = Get-Content $file -Raw

  foreach($m in $map) { $t = $t.Replace($m.a, $m.b) }

  # Nuke the classic arrow-mojibake if it ever appears in UI strings
  $t = $t -replace 'ÃƒÂ¢Ã¢â‚¬Â\s*Ã¢â‚¬â„¢', '-'

  Write-Utf8NoBom $file $t
  Write-Host "Patched UI tokens in: $file" -ForegroundColor Green
}

Write-Host "Backups saved to: $bkDir" -ForegroundColor Cyan
