#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting..."
  bun run next start -p 3000 2>&1
  echo "[$(date)] Exited with code $?"
  sleep 2
done
