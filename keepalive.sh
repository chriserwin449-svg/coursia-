#!/bin/bash
while true; do
  echo "[$(date)] Starting server..."
  node .next/standalone/server.js 2>&1
  EXITCODE=$?
  echo "[$(date)] Exited with code $EXITCODE, restarting..."
  sleep 1
done
