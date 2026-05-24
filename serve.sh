#!/bin/bash
cd /home/z/my-project
LOG=/home/z/my-project/dev.log

echo "=== Coursia Server ===" > $LOG
echo "Starting production server with keepalive..." >> $LOG

while true; do
  # Start Next.js production server
  NODE_OPTIONS="--max-old-space-size=512" npx next start -p 3000 >> $LOG 2>&1 &
  SRV_PID=$!
  
  # Start pinger to keep sandbox alive (request every 2s)
  (while kill -0 $SRV_PID 2>/dev/null; do
    curl -s -o /dev/null http://localhost:3000 2>/dev/null
    sleep 2
  done) &
  PING_PID=$!
  
  echo "[$(date)] Server started (pid=$SRV_PID, pinger=$PING_PID)" >> $LOG
  
  # Wait for server to die
  wait $SRV_PID 2>/dev/null
  kill $PING_PID 2>/dev/null
  
  echo "[$(date)] Server died, restarting in 2s..." >> $LOG
  sleep 2
done
