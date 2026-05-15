#!/bin/bash
cd /home/z/my-project

while true; do
    if ! curl -s -o /dev/null -w "" http://localhost:3000 2>/dev/null; then
        echo "[$(date)] Restarting..." >> /home/z/my-project/keep-alive.log
        pkill -f "next" 2>/dev/null
        sleep 2
        nohup npx next start -p 3000 >> /home/z/my-project/dev.log 2>&1 &
        sleep 5
    fi
    # Keep the server "active" by pinging it
    curl -s -o /dev/null http://localhost:3000 2>/dev/null
    sleep 10
done
