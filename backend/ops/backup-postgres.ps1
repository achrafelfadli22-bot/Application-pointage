param(
  [string]$OutputDir = "$(Get-Location)\backups",
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$PgDumpPath = $env:PG_DUMP_PATH
)

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "DATABASE_URL is required. Set it in the environment or pass -DatabaseUrl."
}

if ([string]::IsNullOrWhiteSpace($PgDumpPath)) {
  $PgDumpPath = "pg_dump"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $OutputDir "pointage360-$timestamp.dump"

& $PgDumpPath `
  --format=custom `
  --no-owner `
  --no-privileges `
  --file $backupFile `
  $DatabaseUrl

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

Write-Output "Backup created: $backupFile"
