#!/bin/bash
while true; do
  cd /home/z/my-project
  bun run dev &
  PID=$!
  sleep 15
  while kill -0 $PID 2>/dev/null; do sleep 2; done
  sleep 2
done
