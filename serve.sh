#!/bin/bash
cd /home/z/my-project

while true; do
  echo "[$(date '+%H:%M:%S')] Starting static server..."
  node /home/z/my-project/static-server.cjs > /home/z/my-project/dev.log 2>&1 &
  PID=$!
  
  # Wait for it to bind
  sleep 3
  
  # Monitor
  while kill -0 $PID 2>/dev/null && ss -tlnp 2>/dev/null | grep -q ":3000 "; do
    sleep 2
  done
  
  echo "[$(date '+%H:%M:%S')] Server died, cleaning up..."
  kill $PID 2>/dev/null
  wait $PID 2>/dev/null
  sleep 2
done
