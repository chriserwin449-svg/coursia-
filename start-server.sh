#!/bin/bash
# Coursia server launcher - run this first!
# Usage: bash /home/z/my-project/start-server.sh

cd /home/z/my-project

# Kill any existing
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null

# Start watchdog
node /home/z/my-project/mini-services/keep-alive/start.cjs &
WATCHDOG_PID=$!

echo "Watchdog PID: $WATCHDOG_PID"
echo "Waiting for Next.js to start..."

# Wait up to 30s for it
for i in $(seq 1 30); do
  sleep 1
  if curl -s --max-time 2 http://localhost:3000/api/db-status | grep -q "ok" 2>/dev/null; then
    echo "✅ Coursia is LIVE on port 3000!"
    echo "✅ Caddy gateway on port 81"
    exit 0
  fi
done

echo "❌ Failed to start within 30s"
exit 1
