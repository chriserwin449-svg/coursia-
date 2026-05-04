#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting production server..."
  node .next/standalone/server.js
  echo "[$(date)] Server exited, restarting in 2s..."
  sleep 2
done
