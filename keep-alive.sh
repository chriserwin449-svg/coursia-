#!/bin/bash
# Coursia dev server keep-alive watchdog
while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    echo "$(date) - Server down, restarting..." >> /home/z/my-project/dev.log
    cd /home/z/my-project && setsid bun run dev >> /home/z/my-project/dev.log 2>&1 &
    disown
    sleep 8
  fi
  sleep 10
done
