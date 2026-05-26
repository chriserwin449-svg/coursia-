#!/bin/sh
cd /home/z/my-project
while true; do
  npx next start -p 3000 2>&1
  echo "$(date) - Server died, restarting in 3s..."
  sleep 3
done
