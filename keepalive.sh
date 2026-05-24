#!/bin/bash
cd /home/z/my-project
while true; do
  npx next start -p 3000 >> /home/z/my-project/dev.log 2>&1
  echo "$(date): Restarted" >> /home/z/my-project/dev.log
  sleep 2
done
