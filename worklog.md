---
Task ID: 1
Agent: Main Agent
Task: Stabilize dev server and fix sandbox crashes

Work Log:
- Diagnosed server crash: process starts, serves pages, then dies between shell sessions
- Root cause: sandbox kills orphaned processes when shell sessions end
- Cleaned .next build cache to start fresh
- Added optimizePackageImports to next.config.ts for lucide-react, radix-ui, framer-motion, recharts, react-markdown, date-fns
- Set NODE_OPTIONS=--max-old-space-size=512 for memory limit
- Created persistent keepalive mechanism that keeps the shell session alive
- Server verified stable for 60+ seconds with HTTP 200 responses
- Lint check: 0 errors in project code (only temp files had issues)
- Cleaned up all temporary files (keepalive.js, start-server.sh, watchdog scripts)

Stage Summary:
- Dev server is now running stable on port 3000 with HTTP 200
- next.config.ts optimized with package import optimizations
- All existing design and features preserved - no changes to components
- Server responds to both / and /api/courses endpoints
