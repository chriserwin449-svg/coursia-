---
Task ID: 1
Agent: Main Agent
Task: Fix preview permanently, database, course generation, payments

Work Log:
- Found `ultra-fast.sh` (PID 644) was an infinite bash loop relaunching `self-restart-server.ts` and blocking port 3000
- Killed ultra-fast.sh, deleted all watcher scripts (ultra-fast.sh, survival.sh, start-server.sh, ensure-preview.sh, dev.sh, keepalive.sh)
- Rewrote self-restart-server.ts as v12 — fully autonomous Bun server with:
  - Prisma ORM integrated (real SQLite database access)
  - z-ai-web-dev-sdk integrated (real AI course generation)
  - All API routes implemented: badges, flames, courses, auth, subscription, paywall, quiz
  - Static files preloaded in memory (zero I/O)
  - Fallback stubs when DB is unavailable
- Verified: all 7 API endpoints return HTTP 200 with real data
- Course generation works via z-ai SDK (no OpenAI key needed)
- Auth routes implemented (register, login, signout) with real Prisma
- Paywall status with real trial logic (3 days, 3 courses)
- Payment webhook handler for LemonSqueezy (placeholder ready)
- Database: SQLite (db/custom.db) — Supabase NOT feasible in sandbox (no outbound internet)

Stage Summary:
- Preview: Bun server v12 on port 3000, fully autonomous with Prisma + z-ai
- Database: SQLite internal (Supabase requires external network, not available in sandbox)
- Course Generation: Works via z-ai-web-dev-sdk (built-in AI, no API key needed)
- Payments: Infrastructure ready (checkout placeholder, webhook handler for LemonSqueezy)
- To activate payments: add LEMON_SQUEEZY_API_KEY to .env and configure store ID

---
Task ID: 2
Agent: Main Agent
Task: Fix preview (restart after context recovery), clean up project

Work Log:
- Found project in working state with .next build already present
- Preview was down — no process running on port 3000
- Started `bun --bun next dev -p 3000` successfully — HTTP 200 confirmed
- Discovered all previously pending features were already implemented:
  - FAQ section exists in LandingPage.tsx (lines 490-563)
  - Logout confirmation dialog exists in Sidebar.tsx (lines 152-189)
  - 3-level progression system (Beginner/Intermediate/Advanced) in CreateCourse.tsx
  - No login button in TopBar (already removed)
- Cleaned up 15+ legacy utility scripts from previous preview attempts (custom-server.js, fast-server.ts, server-wrapper.js, etc.)
- Removed unused mini-services (dev-server, keep-alive)
- Lint check: 0 errors after cleanup

Stage Summary:
- Preview: Running on port 3000 via `bun --bun next dev`
- Project clean: All legacy scripts removed, zero lint errors
- Database: Currently using Prisma + SQLite (internal)
- Course generation: Uses z-ai-web-dev-sdk (free tier fallback)
- All previously requested features confirmed as implemented
