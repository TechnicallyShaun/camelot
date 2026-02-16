# Camelot Installer (Windows PowerShell)
# Idempotent — safe to re-run for updates.

$ErrorActionPreference = "Stop"
$INSTALL_DIR = "$env:USERPROFILE\.camelot"
$PORT = 1187

Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkYellow
Write-Host "       CAMELOT - AI Development Cockpit" -ForegroundColor Yellow
Write-Host "  ============================================" -ForegroundColor DarkYellow
Write-Host ""

# --- Dependency checks ---
Write-Host "[1/5] Checking dependencies..." -ForegroundColor Cyan

$nodeVersion = $null
try { $nodeVersion = (node --version 2>$null) } catch {}
if (-not $nodeVersion) {
    Write-Host "  ERROR: Node.js is not installed. Install from https://nodejs.org (v18+)" -ForegroundColor Red
    exit 1
}
$major = [int]($nodeVersion -replace '^v','').Split('.')[0]
if ($major -lt 18) {
    Write-Host "  ERROR: Node.js $nodeVersion is too old. Need v18+." -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js $nodeVersion" -ForegroundColor Green

$npmVersion = $null
try { $npmVersion = (npm --version 2>$null) } catch {}
if (-not $npmVersion) {
    Write-Host "  ERROR: npm is not installed." -ForegroundColor Red
    exit 1
}
Write-Host "  npm v$npmVersion" -ForegroundColor Green

# --- Stop existing server if running ---
Write-Host ""
Write-Host "[2/5] Stopping existing Camelot server..." -ForegroundColor Cyan
$procs = Get-NetTCPConnection -LocalPort $PORT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pid in $procs) {
    try {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq "node") {
            Write-Host "  Stopping node process $pid on port $PORT" -ForegroundColor Yellow
            Stop-Process -Id $pid -Force
            Start-Sleep -Seconds 1
        }
    } catch {}
}
Write-Host "  Done" -ForegroundColor Green

# --- Copy files ---
Write-Host ""
Write-Host "[3/5] Installing files to $INSTALL_DIR..." -ForegroundColor Cyan

if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    Write-Host "  Created $INSTALL_DIR" -ForegroundColor Green
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Copy dist, public, package files
foreach ($item in @("dist", "public", "package.json", "package-lock.json")) {
    $src = Join-Path $scriptDir $item
    $dst = Join-Path $INSTALL_DIR $item
    if (Test-Path $src) {
        if (Test-Path $dst) {
            Remove-Item $dst -Recurse -Force
        }
        Copy-Item $src $dst -Recurse -Force
        Write-Host "  Copied $item" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: $item not found in release" -ForegroundColor Yellow
    }
}

# --- Install dependencies ---
Write-Host ""
Write-Host "[4/5] Installing npm dependencies..." -ForegroundColor Cyan
Push-Location $INSTALL_DIR
try {
    npm install --production 2>&1 | Out-Null
    Write-Host "  npm install complete" -ForegroundColor Green

    # Rebuild native modules for this platform
    Write-Host "  Rebuilding native modules..." -ForegroundColor Cyan
    npm rebuild better-sqlite3 2>&1 | Out-Null
    Write-Host "  Native modules rebuilt" -ForegroundColor Green
} finally {
    Pop-Location
}

# --- Initialize database ---
Write-Host ""
Write-Host "[5/5] Initializing database..." -ForegroundColor Cyan

# Start server briefly to trigger DB init, then verify
$serverProc = Start-Process -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory $INSTALL_DIR -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3

try {
    $health = Invoke-RestMethod -Uri "http://localhost:$PORT/api/health" -TimeoutSec 5
    if ($health.status -eq "ok") {
        Write-Host "  Database initialized and server healthy" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Server responded but health check unexpected" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  WARNING: Could not verify server health: $_" -ForegroundColor Yellow
}

# Leave server running
Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkYellow
Write-Host "       Camelot is running!" -ForegroundColor Green
Write-Host "       http://localhost:$PORT" -ForegroundColor White
Write-Host "  ============================================" -ForegroundColor DarkYellow
Write-Host ""
Write-Host "  Install location: $INSTALL_DIR" -ForegroundColor Gray
Write-Host "  To stop:  Stop-Process -Id $($serverProc.Id)" -ForegroundColor Gray
Write-Host "  To start: cd $INSTALL_DIR; node dist/index.js" -ForegroundColor Gray
Write-Host ""
