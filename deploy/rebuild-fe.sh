#!/usr/bin/env bash
# Clean rebuild + PM2 restart for edutest frontend (fixes broken CSS after partial deploys).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
export NVM_DIR="${HOME}/.nvm"
# shellcheck source=/dev/null
[ -s "${NVM_DIR}/nvm.sh" ] && . "${NVM_DIR}/nvm.sh"

echo "Stopping edutest-fe and freeing port 3000…"
pm2 stop edutest-fe 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
# Orphan next start (not under PM2) causes stale HTML/CSS after rebuild
pkill -f "next start.*3000" 2>/dev/null || true
sleep 2

echo "Clean build…"
rm -rf .next
npm run build

echo "Starting edutest-fe…"
pm2 start "${ROOT}/deploy/start-fe.sh" --name edutest-fe 2>/dev/null || pm2 restart edutest-fe

echo "Done. Verify: curl -sI http://127.0.0.1:3000/ru/student/tests | head -3"
