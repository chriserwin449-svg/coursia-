#!/bin/bash
cd /home/z/my-project
while true; do
    echo "Starting Next.js dev server..."
    rm -rf .next
    node_modules/.bin/next dev -p 3000 &
    SERVER_PID=$!
    
    # Wait for server to be ready
    for i in $(seq 1 30); do
        if ! kill -0 $SERVER_PID 2>/dev/null; then
            echo "Server died during startup, restarting..."
            break
        fi
        if ss -tlnp 2>/dev/null | rg -q 3000; then
            echo "Server ready (PID: $SERVER_PID)"
            # Warm up the first compilation
            sleep 1
            curl -s --max-time 30 http://localhost:3000/ -o /dev/null 2>&1
            echo "Compilation done"
            break
        fi
        sleep 1
    done
    
    # Keep alive by monitoring
    while kill -0 $SERVER_PID 2>/dev/null; do
        # Also keep connection warm every 10s
        if ss -tlnp 2>/dev/null | rg -q 3000; then
            sleep 10
        else
            echo "Port 3000 no longer listening, restarting..."
            break
        fi
    done
    
    echo "Server process exited, restarting in 2s..."
    kill -9 $SERVER_PID 2>/dev/null
    sleep 2
done
