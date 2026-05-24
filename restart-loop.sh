#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--max-old-space-size=256" ./node_modules/.bin/next start -p 3000 -H 127.0.0.1
  echo "[$(date)] Server died, restarting in 1s..." >> /tmp/restart.log
  sleep 1
done
