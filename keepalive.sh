#!/bin/bash
while true; do
  NODE_ENV=production npx next start -p 3000 &
  PID=$!
  echo "Started server PID: $PID at $(date)"
  sleep 5
  # Check if process is still alive
  if kill -0 $PID 2>/dev/null; then
    wait $PID
    echo "Server exited at $(date), restarting..."
  else
    echo "Server died immediately at $(date), restarting..."
  fi
  sleep 2
done
