#!/bin/bash
# Coursia Ultra-Fast Restart Loop
# Keeps the preview server alive by instantly restarting when sandbox kills it
exec 2>/dev/null
while true; do
  bun self-restart-server.ts 2>/dev/null
done
