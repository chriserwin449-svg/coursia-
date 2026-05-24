#!/bin/bash
# ══════════════════════════════════════════════════════════════
# COURSIA ULTIMATE WATCHDOG (v4) - No fuser dependency
# Uses lsof or /proc to find port users
# ══════════════════════════════════════════════════════════════
BASE="/home/z/my-project"
LOG="$BASE/dev.log"
PORT=3000

log() { echo "[$(date '+%H:%M:%S')] $1" >> "$LOG"; }

# Kill process on port without fuser
kill_port() {
  # Method 1: lsof
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti :$PORT 2>/dev/null)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill -9 2>/dev/null
      log "Killed via lsof: $pids"
    fi
  fi
  
  # Method 2: /proc net
  if [ -d /proc/net ]; then
    # Find PIDs using port 3000 via /proc
    for pid_dir in /proc/[0-9]*/fd; do
      if ls -la "$pid_dir" 2>/dev/null | grep -q "socket:"; then
        # Check if this process is bun or node
        local pid
        pid=$(echo "$pid_dir" | cut -d/ -f3)
        if [ -n "$pid" ] && [ "$pid" != "self" ]; then
          local cmdline
          cmdline=$(cat "/proc/$pid/cmdline" 2>/dev/null | tr '\0' ' ')
          if echo "$cmdline" | grep -q "self-restart-server\|next\|node.*3000"; then
            kill -9 "$pid" 2>/dev/null
            log "Killed pid=$pid ($cmdline)"
          fi
        fi
      fi
    done
  fi
  
  # Method 3: pgrep (most reliable)
  pkill -9 -f "self-restart-server" 2>/dev/null
  
  sleep 0.5
}

# Start server
start_server() {
  kill_port
  cd "$BASE"
  nohup bun self-restart-server.ts >> "$LOG" 2>&1 &
  local pid=$!
  log "SERVER STARTED pid=$pid"
  sleep 2
}

# Check server
check_server() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:$PORT/ 2>/dev/null)
  [ "$code" = "200" ]
}

# ═══ MAIN ═══
log "═══ WATCHDOG v4 STARTED ═══"

# Initial start
start_server

while true; do
  if check_server; then
    : # OK
  else
    log "SERVER DOWN! Restarting..."
    start_server
    if check_server; then
      log "RECOVERED"
    else
      log "RETRY: Force kill all..."
      pkill -9 -f "self-restart-server" 2>/dev/null
      pkill -9 -f "bun.*self-restart" 2>/dev/null
      sleep 2
      start_server
      if check_server; then
        log "RECOVERED after force kill"
      else
        log "STILL DOWN - will retry in 10s"
      fi
    fi
  fi
  sleep 10
done
