#!/bin/bash
cd /home/z/my-project/.next/standalone
while true; do
    node server.js 2>&1
    echo "[server] Died, restarting in 1s..."
    sleep 1
done
