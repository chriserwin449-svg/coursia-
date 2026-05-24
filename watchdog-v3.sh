#!/bin/bash
# ══════════════════════════════════════════════════════════════
# COURSIA ULTIMATE WATCHDOG (v3) - Single self-healing process
# No separate supervisor needed. This single loop:
# 1. Starts server if not running
# 2. Checks server responds every 10s
# 3. If dead, kills port and restarts
# 4. Logs everything
# ══════════════════════════════════════════════════════════════
BASE="/home/z/my-project"
LOG="$BASE/dev.log"
MARKER="$BASE/.watchdog_alive"
SERVER_PID=""

log() { echo "[$(date '+%H:%M:%S')] $1" >> "$LOG"; }

# Kill everything on port 3000
nuke_port() {
  fuser -k 3000/tcp 2>/dev/null
  pkill -f "self-restart-server" 2>/dev/null
  sleep 0.5
}

# Start fresh server
start_server() {
  nuke_port
  cd "$BASE"
  nohup bun self-restart-server.ts >> "$LOG" 2>&1 &
  SERVER_PID=$!
  log "SERVER STARTED pid=$SERVER_PID"
  sleep 2
}

# Check if server responds with HTTP 200
check_server() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ]
}

# ═══ MAIN LOOP ═══
log "═══ WATCHDOG v3 STARTED ═══"

# Initial start
start_server

# Heartbeat loop
while true; do
  # Update marker file (so external scripts can check we're alive)
  echo "$(date +%s)" > "$MARKER"
  
  if check_server; then
    : # Silent - server OK
  else
    log "SERVER UNRESPONSIVE! Restarting..."
    start_server
    
    # Double-check after restart
    if ! check_server; then
      log "RETRY failed, nuking everything and retrying..."
      nuke_port
      sleep 1
      start_server
    fi
    
    if check_server; then
      log "SERVER RECOVERED OK"
    else
      log "FATAL: Could not restart server"
    fi
  fi
  
  sleep 10
done
