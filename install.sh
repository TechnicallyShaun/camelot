#!/usr/bin/env bash
# Camelot Installer (Linux/macOS)
# Idempotent — safe to re-run for updates.

set -e

INSTALL_DIR="$HOME/.camelot"
PORT=1187
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  ============================================"
echo "       CAMELOT - AI Development Cockpit"
echo "  ============================================"
echo ""

# --- Dependency checks ---
echo "[1/5] Checking dependencies..."

if ! command -v node &>/dev/null; then
    echo "  ERROR: Node.js is not installed. Install from https://nodejs.org (v18+)"
    exit 1
fi
NODE_VERSION=$(node --version)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "  ERROR: Node.js $NODE_VERSION is too old. Need v18+."
    exit 1
fi
echo "  ✓ Node.js $NODE_VERSION"

if ! command -v npm &>/dev/null; then
    echo "  ERROR: npm is not installed."
    exit 1
fi
echo "  ✓ npm v$(npm --version)"

# --- Stop existing server ---
echo ""
echo "[2/5] Stopping existing Camelot server..."
PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
for pid in $PIDS; do
    if ps -p "$pid" -o comm= 2>/dev/null | grep -q node; then
        echo "  Stopping node process $pid on port $PORT"
        kill "$pid" 2>/dev/null || true
        sleep 1
    fi
done
echo "  Done"

# --- Copy files ---
echo ""
echo "[3/5] Installing files to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

for item in dist public package.json package-lock.json; do
    src="$SCRIPT_DIR/$item"
    dst="$INSTALL_DIR/$item"
    if [ -e "$src" ]; then
        rm -rf "$dst"
        cp -r "$src" "$dst"
        echo "  ✓ Copied $item"
    else
        echo "  ⚠ WARNING: $item not found in release"
    fi
done

# --- Install dependencies ---
echo ""
echo "[4/5] Installing npm dependencies..."
cd "$INSTALL_DIR"
npm install --production --silent
echo "  ✓ npm install complete"

echo "  Rebuilding native modules..."
npm rebuild better-sqlite3 --silent 2>/dev/null || true
echo "  ✓ Native modules rebuilt"

# --- Initialize database ---
echo ""
echo "[5/5] Initializing database..."
node dist/index.js &
SERVER_PID=$!
sleep 3

if curl -sf "http://localhost:$PORT/api/health" | grep -q '"ok"'; then
    echo "  ✓ Database initialized and server healthy"
else
    echo "  ⚠ WARNING: Could not verify server health"
fi

echo ""
echo "  ============================================"
echo "       Camelot is running!"
echo "       http://localhost:$PORT"
echo "  ============================================"
echo ""
echo "  Install location: $INSTALL_DIR"
echo "  To stop:  kill $SERVER_PID"
echo "  To start: cd $INSTALL_DIR && node dist/index.js"
echo ""
