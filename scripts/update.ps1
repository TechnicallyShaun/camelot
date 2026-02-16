# Camelot Update Script
param(
    [string]$Path = "$env:USERPROFILE\.camelot"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "$Path\package.json")) {
    Write-Host "❌ Camelot not found at $Path" -ForegroundColor Red
    exit 1
}

Write-Host "🔄 Updating Camelot..." -ForegroundColor Cyan

Push-Location $Path

# Pull latest
git pull --ff-only
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git pull failed. Check for local changes." -ForegroundColor Red
    Pop-Location
    exit 1
}

# Reinstall deps (in case they changed)
Write-Host "📦 Updating dependencies..." -ForegroundColor Yellow
npm ci --production 2>&1 | Out-Null

# Rebuild
Write-Host "🔨 Building..." -ForegroundColor Yellow
npm run build 2>&1 | Out-Null

Pop-Location

Write-Host "✅ Camelot updated! Restart the server to apply changes." -ForegroundColor Green
