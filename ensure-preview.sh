#!/bin/bash
# ensure-preview.sh — ALWAYS run before any server check
# Idempotent: starts server only if not running
cd /home/z/my-project

STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:3000/ 2>/dev/null)
if [ "$STATUS" = "200" ]; then
  echo "✓ Running"
  return 0 2>/dev/null || exit 0
fi

lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 0.3

if [ ! -f ".next/server/app/index.html" ]; then
  echo "Building..."
  npx next build 2>&1 | tail -5
fi

nohup node server.js > dev.log 2>&1 &
sleep 2

STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:3000/ 2>/dev/null)
echo "${STATUS}" = "200" > /dev/null && echo "✓ Running" || echo "✗ Failed"
