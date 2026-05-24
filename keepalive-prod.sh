#!/bin/bash
cd /home/z/my-project
while true; do
  echo "$(date): Starting Next.js production server..."
  NODE_OPTIONS="--max-old-space-size=256" ./node_modules/.bin/next start -p 3000 -H 0.0.0.0 >> dev.log 2>&1
  EXIT=$?
  echo "$(date): Exited code=$EXIT. Restarting in 2s..." >> dev.log 2>&1
  sleep 2
done
