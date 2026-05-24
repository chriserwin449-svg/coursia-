#!/bin/bash
# ══════════════════════════════════════════════════════════════
# COURSIA SUPERVISOR - Watches the watchdog
# Runs as a separate detached process. If watchdog dies,
# supervisor restarts it. If server dies, supervisor also 
# detects and forces restart.
# ══════════════════════════════════════════════════════════════
BASE="/home/z/my-project"
LOG="$BASE/dev.log"

log() { echo "[$(date '+%H:%M:%S')] [SUPERVISOR] $1" >> "$LOG"; }

start_watchdog() {
  cd "$BASE"
  nohup bash watchdog.sh >> "$LOG" 2>&1 &
  log "Watchdog spawned as PID $!"
  sleep 3
}

is_server_alive() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:3000/ 2>/dev/null)
  echo "$code" | grep -q "200"
}

is_watchdog_alive() {
  pgrep -f "watchdog.sh" > /dev/null 2>&1
}

log "═══ SUPERVISOR STARTED ═══"

# Start watchdog on first run
start_watchdog

while true; do
  # Check server first (most important)
  if ! is_server_alive; then
    if ! is_watchdog_alive; then
      log "BOTH server and watchdog dead! Emergency full restart..."
    else
      log "Server dead but watchdog alive, waiting..."
    fi
    # Give watchdog 10 seconds to fix it
    sleep 10
    if ! is_server_alive; then
      log "Still dead after 10s. Force killing everything and restarting..."
      fuser -k 3000/tcp 2>/dev/null
      pkill -f "watchdog.sh" 2>/dev/null
      pkill -f "self-restart-server" 2>/dev/null
      sleep 2
      start_watchdog
    fi
  fi

  # Check watchdog itself
  if ! is_watchdog_alive; then
    log "Watchdog died! Respawning..."
    start_watchdog
  fi

  sleep 20
done
