# Scan repo for mojibake (excluding .next and node_modules)
param(
  [string]$Root = (Get-Location).Path
)

Get-ChildItem -Recurse -File -Path $Root -Include *.ts,*.tsx,*.css,*.html |
  Where-Object { $_.FullName -notmatch '\\\.next\\' -and $_.FullName -notmatch '\\node_modules\\' } |
  Select-String -Pattern 'Ã','Â','â€™','â€“','â€”','â€œ','â€' |
  Select Path, LineNumber, Line
