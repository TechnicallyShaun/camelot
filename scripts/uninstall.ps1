# Camelot Uninstall Script
param(
    [string]$Path = "$env:USERPROFILE\.camelot",
    [switch]$KeepData
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Path)) {
    Write-Host "Camelot not found at $Path" -ForegroundColor Yellow
    exit 0
}

Write-Host "🏰 Uninstalling Camelot from $Path" -ForegroundColor Cyan

if ($KeepData) {
    # Backup data directory
    $dataDir = Join-Path $Path "data"
    $backupDir = "$env:USERPROFILE\.camelot-data-backup"
    if (Test-Path $dataDir) {
        Write-Host "💾 Backing up data to $backupDir" -ForegroundColor Yellow
        Copy-Item -Path $dataDir -Destination $backupDir -Recurse -Force
    }
}

Remove-Item -Path $Path -Recurse -Force

Write-Host "✅ Camelot uninstalled." -ForegroundColor Green
if ($KeepData) {
    Write-Host "   Data backup: $backupDir" -ForegroundColor Gray
}
