#!/bin/bash
# Watchdog script - keeps Next.js dev server alive
cd /home/z/my-project
while true; do
  if ! lsof -i :3000 >/dev/null 2>&1; then
    echo "[$(date)] Server down, restarting..." >> /tmp/watchdog.log
    nohup npx next dev -p 3000 -H 127.0.0.1 >> /tmp/next-out.log 2>&1 &
    disown
  fi
  sleep 10
done &
echo "Watchdog started (PID: $!)"
