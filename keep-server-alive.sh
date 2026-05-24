#!/bin/bash
cd /home/z/my-project
while true; do
  echo "$(date) [KEEPALIVE] Starting server..." >> keepalive.log
  NODE_OPTIONS="--max-old-space-size=384" npx next start -p 3000 >> dev.log 2>&1
  EXIT=$?
  echo "$(date) [KEEPALIVE] Server exited with code $EXIT, restarting in 3s..." >> keepalive.log
  sleep 3
done
