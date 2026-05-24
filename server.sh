#!/bin/bash
cd /home/z/my-project
while true; do
  > dev.log
  node node_modules/.bin/next dev -p 3000 -H 0.0.0.0 >> dev.log 2>&1
  sleep 2
done
