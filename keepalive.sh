#!/bin/bash
# Keepalive script for Next.js dev server
cd /home/z/my-project

while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ':3000'; then
    echo "[$(date)] Server not running, starting..."
    rm -rf .next
    npx next dev -p 3000 &
    sleep 20
  fi
  sleep 10
done
