#!/bin/bash
# ══════════════════════════════════════════════════════════════
# COURSIA SERVER GUARDIAN (runs via cron every minute)
# This is the LAST line of defense. If both the server AND
# the watchdog die, this script brings everything back.
# ══════════════════════════════════════════════════════════════
BASE="/home/z/my-project"
LOG="$BASE/dev.log"
LOCK="$BASE/.guardian.lock"

# Prevent concurrent runs
if [ -f "$LOCK" ] && [ $(( $(date +%s) - $(cat "$LOCK" 2>/dev/null || echo 0) )) -lt 45 ]; then
  exit 0
fi
echo $(date +%s) > "$LOCK"

log() { echo "[$(date '+%H:%M:%S')] [GUARDIAN] $1" >> "$LOG"; }

# Check if server responds
code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:3000/ 2>/dev/null)

if echo "$code" | grep -q "200"; then
  : # Server fine, do nothing
else
  log "Server DOWN (HTTP $code). Checking watchdog..."
  
  # Check if watchdog is running
  if pgrep -f "watchdog.sh" > /dev/null 2>&1; then
    log "Watchdog alive, it should handle restart"
  else
    log "Watchdog ALSO dead! Emergency restart..."
    # Kill leftover processes
    fuser -k 3000/tcp 2>/dev/null
    pkill -f "self-restart-server" 2>/dev/null
    sleep 1
    # Start watchdog
    cd "$BASE"
    nohup bash watchdog.sh > /dev/null 2>&1 &
    log "Emergency restart done"
  fi
fi
