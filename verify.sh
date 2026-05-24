#!/bin/bash
cd /home/z/my-project
node node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

sleep 15

# Check if server is alive
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "SERVER_ALIVE=YES"
else
    echo "SERVER_ALIVE=NO"
fi

# Get HTTP status
HTTP_CODE=$(curl -s --max-time 10 -o /home/z/my-project/page.html -w "%{http_code}" http://localhost:3000)
echo "HTTP_CODE=$HTTP_CODE"

# Check for keywords
echo "=== DEV LOG (last 20 lines) ==="
tail -20 /home/z/my-project/dev.log

echo "=== HTML CHECK ==="
if [ -f /home/z/my-project/page.html ]; then
    SIZE=$(wc -c < /home/z/my-project/page.html)
    echo "HTML_SIZE=$SIZE bytes"
    head -50 /home/z/my-project/page.html
    echo "=== KEYWORD CHECK ==="
    rg -i "div|Coursia|<html|<body|<app" /home/z/my-project/page.html && echo "FOUND" || echo "NOT FOUND"
else
    echo "NO HTML FILE"
fi
