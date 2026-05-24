#!/bin/bash
# Double-fork to create an orphan process that gets reparented to PID 1 (tini)
# This is the only way to survive in this container

# Kill existing
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

# Start the watchdog - it will be orphaned when this shell exits
node /home/z/my-project/mini-services/keep-alive/start.cjs &
WATCHDOG=$!

# Disown to prevent the shell from killing it
disown $WATCHDOG 2>/dev/null

# Exit immediately - the child should be reparented to PID 1
exit 0
