#!/bin/bash
# ══════════════════════════════════════════════════════════════
# COURSIA SELF-HEALING SERVER (v5)
# This script IS the server. No separate watchdog needed.
# - Serves via bun self-restart-server.ts
# - If bun crashes, THIS script restarts it immediately
# - This script itself is kept alive via nohup
# - Built-in health check loop
# ══════════════════════════════════════════════════════════════
BASE="/home/z/my-project"
LOG="$BASE/dev.log"
SERVER_SCRIPT="$BASE/self-restart-server.ts"
HEALTH_URL="http://localhost:3000/"
SLEEP_CHECK=8

log() { echo "[$(date '+%H:%M:%S')] $1" >> "$LOG"; }

# Kill any existing bun server
cleanup() {
  pkill -9 -f "self-restart-server" 2>/dev/null
  sleep 0.3
}

# Health check
is_healthy() {
  [ "$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 2 "$HEALTH_URL" 2>/dev/null)" = "200" ]
}

# ═══ MAIN ═══
log "═══ SELF-HEALING SERVER v5 ═══"

while true; do
  cleanup
  
  # Start the Bun server in background
  cd "$BASE"
  bun "$SERVER_SCRIPT" >> "$LOG" 2>&1 &
  SRV_PID=$!
  log "Started server pid=$SRV_PID"
  
  # Wait for it to become ready
  READY=0
  for i in $(seq 1 10); do
    sleep 0.5
    if is_healthy; then
      READY=1
      log "Server ready (healthy)"
      break
    fi
    # Check if process still exists
    if ! kill -0 $SRV_PID 2>/dev/null; then
      log "Server process died during startup (exit)"
      break
    fi
  done
  
  if [ "$READY" = "0" ]; then
    log "Server failed to start, retrying in 2s..."
    sleep 2
    continue
  fi
  
  # Now monitor: wait for server to die or become unhealthy
  while true; do
    sleep $SLEEP_CHECK
    
    # Check if process still alive
    if ! kill -0 $SRV_PID 2>/dev/null; then
      log "Server process died! Restarting..."
      break
    fi
    
    # Health check
    if ! is_healthy; then
      log "Server unhealthy! Force killing and restarting..."
      kill -9 $SRV_PID 2>/dev/null
      sleep 0.5
      break
    fi
  done
  
  # Small delay before restart to avoid rapid loop
  sleep 1
done
