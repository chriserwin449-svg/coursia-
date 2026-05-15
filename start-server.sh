#!/bin/bash
while true; do
  bun /tmp/lazy-server.ts 2>&1
  echo "Restarting..."
  sleep 0.5
done
