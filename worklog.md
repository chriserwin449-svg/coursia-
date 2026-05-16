---
Task ID: 1
Agent: Main Agent
Task: Integrate admin OpenAI API key + Remove Settings page + Supabase integration setup

Work Log:
- Created `.env.local` with user's OpenAI API key (`sk-svcacct-...`)
- Deleted `src/components/coursia/SettingsPage.tsx` entirely
- Deleted `src/app/api/api-keys/` directory (route.ts + validate/route.ts)
- Removed `ApiKey` model from `prisma/schema.prisma`
- Ran `bun run db:push` to sync SQLite schema
- Updated `src/lib/openai.ts`: removed DB key lookup (`db.apiKey.findFirst`), now reads only from `process.env.OPENAI_API_KEY`
- Removed `Settings` import and button from `Sidebar.tsx`
- Removed `SettingsPage` import and view from `AppShell.tsx`
- Removed `"settings"` from `AppView` type in `store.ts`
- Installed `@supabase/supabase-js@2.105.4`
- Created `src/lib/supabase.ts` — Supabase client (public + admin) with auto-detection
- Rewrote `supabase-schema.sql` — matches current Prisma schema (no ApiKey, all current models), with RLS policies
- Rewrote `src/lib/supabase-sync.ts` — full sync module with typed functions: `syncUser()`, `syncCourse()`, `syncChapterProgress()`, `syncFlamePoints()`, `syncFlameTransaction()`, `checkSupabaseStatus()`
- Updated `.env.local` with clear deployment instructions and Supabase placeholder vars
- Updated `prisma/schema.prisma` with comments for SQLite→PostgreSQL switch
- Updated `src/app/api/ai-status/route.ts` to use `getActiveProvider()`
- All lint checks pass (0 errors)

Stage Summary:
- Admin API key integrated: all course generation uses `OPENAI_API_KEY` from `.env.local`
- Settings page completely removed (no user key management)
- Supabase infrastructure ready: client lib, sync module, SQL schema, RLS policies
- Deployment path: user creates Supabase project → runs SQL schema → adds env vars → changes Prisma provider → deploys
