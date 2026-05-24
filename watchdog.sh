#!/bin/bash
# Coursia auto-starter — keeps Next.js alive on port 3000
cd /home/z/my-project

while true; do
  # Check if port 3000 is already in use
  PORT_CHECK=$(ss -tlnp 2>/dev/null | grep ':3000 ' || echo "")
  
  if [ -z "$PORT_CHECK" ]; then
    # Server is down — restart it
    NODE_OPTIONS='--dns-result-order=ipv4first' node node_modules/.bin/next start -p 3000 -H 127.0.0.1 >> /home/z/my-project/dev.log 2>&1 &
    sleep 3
  fi
  
  # Sleep and check again
  sleep 5
done
