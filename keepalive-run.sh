#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========== Starting npx next dev ==========" >> /home/z/my-project/dev.log 2>&1
  npx next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  EXITCODE=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server exited with code $EXITCODE — restarting in 2s..." >> /home/z/my-project/dev.log 2>&1
  sleep 2
done
