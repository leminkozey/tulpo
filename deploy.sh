#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== Tulpo Deploy ==="

# 1. Install dependencies
echo "[1/4] Installing dependencies..."
bun install --frozen-lockfile 2>/dev/null || bun install

# 2. Build frontend
echo "[2/4] Building frontend..."
bun run --filter @tulpo/frontend build

# 3. Stop existing backend
echo "[3/4] Stopping old backend..."
pkill -f "bun src/index.ts" 2>/dev/null && echo "  Stopped." || echo "  Nothing running."
sleep 1

# 4. Start backend (runs migrations automatically on boot)
echo "[4/4] Starting backend..."
nohup bun run --filter @tulpo/backend start > logs/backend.log 2>&1 &
echo "  PID: $!"

sleep 2

# Health check
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
  echo ""
  echo "=== Deploy successful ==="
  echo "Backend running on :3000"
else
  echo ""
  echo "=== WARNING: Health check failed ==="
  echo "Check logs/backend.log"
  tail -20 logs/backend.log 2>/dev/null
fi
