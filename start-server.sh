#!/bin/bash
# Persistent dev server launcher
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
sleep 1
cd /home/z/my-project
exec setsid bun run dev >> /home/z/my-project/dev.log 2>&1
