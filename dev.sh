#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Coursia - start server and verify
# Usage: bash dev.sh
# Run this at the START of every coding session.
# Also run it whenever the preview stops working.
# ══════════════════════════════════════════════════════════════
cd /home/z/my-project

# Kill old
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 0.3

# Ensure build
if [ ! -f ".next/server/app/index.html" ]; then
  echo "Building..."
  npx next build 2>&1 | tail -5
fi

# Start
nohup bun self-restart-server.ts > dev.log 2>&1 &
sleep 2

# Verify
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:3000/)
if [ "$CODE" = "200" ]; then
  echo "✓ Server running (HTTP 200)"
else
  echo "✗ Server failed (HTTP $CODE)"
  tail -5 dev.log
fi
