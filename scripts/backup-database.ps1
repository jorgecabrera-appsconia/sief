param(
  [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL_DIRECT) {
  throw "DATABASE_URL_DIRECT must be configured before creating a backup."
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
  throw "pg_dump is not installed or is not available in PATH."
}

$resolvedRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backupRoot = [System.IO.Path]::GetFullPath((Join-Path $resolvedRoot $OutputDirectory))
if (-not $backupRoot.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "The backup directory must stay inside the repository."
}

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $backupRoot "sief-$timestamp.dump"

& $pgDump.Source --format=custom --no-owner --no-acl --file=$backupFile $env:DATABASE_URL_DIRECT
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE."
}

Write-Output "Backup created: $backupFile"
