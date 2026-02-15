# Camelot Installation Script
# Usage: .\scripts\install.ps1 [-Path <install-dir>]
param(
    [string]$Path = "$env:USERPROFILE\.camelot"
)

$ErrorActionPreference = "Stop"

Write-Host "🏰 Installing Camelot to $Path" -ForegroundColor Cyan

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is required. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

$nodeVersion = (node --version) -replace 'v',''
$major = [int]($nodeVersion.Split('.')[0])
if ($major -lt 20) {
    Write-Host "❌ Node.js 20+ required (found v$nodeVersion)" -ForegroundColor Red
    exit 1
}

# Create install directory
if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

# Download latest release or clone
if (Get-Command git -ErrorAction SilentlyContinue) {
    if (Test-Path "$Path\.git") {
        Write-Host "📥 Updating existing installation..." -ForegroundColor Yellow
        Push-Location $Path
        git pull --ff-only
        Pop-Location
    } else {
        Write-Host "📥 Cloning Camelot..." -ForegroundColor Yellow
        git clone https://github.com/TechnicallyShaun/camelot.git $Path
    }
} else {
    Write-Host "❌ Git is required for installation" -ForegroundColor Red
    exit 1
}

# Install dependencies
Push-Location $Path
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm ci --production 2>&1 | Out-Null

# Build
Write-Host "🔨 Building..." -ForegroundColor Yellow
npm run build 2>&1 | Out-Null

Pop-Location

Write-Host ""
Write-Host "✅ Camelot installed successfully!" -ForegroundColor Green
Write-Host "   Start: cd $Path && npm start" -ForegroundColor Gray
Write-Host "   UI:    http://127.0.0.1:1187" -ForegroundColor Gray
