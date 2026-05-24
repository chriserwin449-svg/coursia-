#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date +%T)] Starting..." >> /home/z/my-project/dev.log
  node node_modules/.bin/next dev -p 3000 -H 0.0.0.0 >> /home/z/my-project/dev.log 2>&1
  echo "[$(date +%T)] Died, restarting in 1s..." >> /home/z/my-project/dev.log
  sleep 1
done
