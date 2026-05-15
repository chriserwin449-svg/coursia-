#!/bin/bash
cd /home/z/my-project
while true; do
  npx next dev --port 3000 2>&1 | tee /tmp/nextjs.log
  sleep 2
done
