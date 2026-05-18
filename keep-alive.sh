#!/bin/bash
# Watchdog that keeps dev server alive
while true; do
    # Check if next-server process is running
    if ! pgrep -f "next-server" > /dev/null 2>&1; then
        echo "$(date): Server down, restarting..." >> /home/z/my-project/watchdog.log
        cd /home/z/my-project
        rm -rf .next 2>/dev/null
        setsid bun run dev >> /home/z/my-project/dev.log 2>&1 &
    fi
    sleep 5
done
