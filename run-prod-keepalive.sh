#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js production..."
  NODE_ENV=production node .next/standalone/server.js 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Exited with code $EXIT_CODE, restarting in 2s..."
  sleep 2
done
