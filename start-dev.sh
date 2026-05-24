#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js..."
  node node_modules/.bin/next dev -p 3000
  echo "[$(date)] Next.js exited, restarting in 3s..."
  sleep 3
done
