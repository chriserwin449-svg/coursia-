#!/bin/bash
# Auto-restart dev server if it dies
cd /home/z/my-project
while true; do
  ss -tlnp 2>/dev/null | grep -q ":3000 "
  if [ $? -ne 0 ]; then
    echo "[$(date)] Restarting dev server..." >> /tmp/dev-watchdog.log
    # Kill any leftover processes
    pkill -f "next dev" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    sleep 1
    # Start fresh
    nohup bun run dev >> /tmp/next-out.log 2>&1 &
    disown
  fi
  sleep 5
done
