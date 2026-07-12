---
Task ID: 1
Agent: main
Task: Replace "Points de flamme" card with "Mes Cours" card + fix CourseViewer crash

Work Log:
- Explored project structure (AppShell SPA, Zustand state router, Journey.tsx, CourseViewer.tsx)
- Identified 3 stats cards in Journey.tsx: Cours Créés, Cours Terminés, Points de flamme
- Replaced "Points de flamme" card with "Mes Cours" card (emerald color, Library icon, shows total course count)
- Added "My Courses" modal with full course list (title, progress bar, completion status)
- Clicking a course in the modal navigates to the CourseViewer
- Added i18n translations (FR: myCourses, myCoursesList, noCourses, openCourse; EN: equivalents)
- Diagnosed CourseViewer crash: "ReferenceError: Cannot access 'getLevelName' before initialization"
  - Root cause: getLevelName was defined at line 568 but referenced in useCallback dependency array at line 453
  - This is a JavaScript Temporal Dead Zone (TDZ) error — const/let variables can't be accessed before their declaration
- Fixed by moving getLevelName definition to line 358 (before all useCallback hooks)
- Also fixed setLoading(false) never called on success in fetchCourse (was causing infinite loading)
- Added defensive null checks: currentChapter access with optional chaining, null content fallback for ReactMarkdown, bounds checking in isChapterLevelLocked and isChapterUnlocked

Stage Summary:
- Journey.tsx: Replaced flame points card with "Mes Cours" card + modal with clickable course list
- CourseViewer.tsx: Fixed critical TDZ crash (getLevelName), fixed setLoading bug, added null safety
- i18n.ts: Added 4 new translation keys for both FR and EN
- All changes verified via Agent Browser end-to-end testing

---
Task ID: 1
Agent: main
Task: Fix badges API, activeCourses stat, level-up Oui/Non, greetings, push to GitHub

Work Log:
- Fixed /api/badges/route.ts: added userId query param filter, added activeCourses count (non-completed courses)
- Fixed Journey.tsx: passes userId to /api/badges, "Mes Cours" box now uses activeCourses instead of totalCourses
- Updated CourseViewer.tsx: level review screen now shows "Veux-tu passer au niveau X ?" with Oui/Non buttons side by side
- Added more greeting variations in i18n.ts (FR: Bienvenue, Content de te voir + 3 new messages; EN: Welcome back, Great to see you + 3 new messages)
- Verified random topic already forces level 0 (Débutant) in CreateCourse.tsx
- Pushed to GitHub: 971cfe9

Stage Summary:
- Bug fix: Cours créés/Mes Cours no longer show wrong counts (was counting ALL users' courses)
- UX: Level progression now has clear Oui/Non choice after each level completion
- Verified chapter completion celebration message already works (shows "Chapitre X terminé ! 🎉" for 2s)
- Verified random course always starts at Débutant
- All changes pushed to main branch

---
Task ID: 2
Agent: fullstack-developer
Task: Fix per-user flame points (was global — all users shared one balance)

Work Log:
- Identified root cause: All 5 API routes used `db.appSettings.upsert({ where: { id: "main" } })` — a single shared row
- Created shared helper `src/lib/get-user-id.ts` that extracts userId from Authorization header, query params, or request body
- Added `userId` field to `FlameTransaction` model in Prisma schema + auto-migrate
- Fixed 5 backend API routes to use per-user AppSettings (userId as the row id):
  1. `src/app/api/flames/route.ts` (GET + POST) — now filters transactions by userId
  2. `src/app/api/courses/[id]/chapters/[chapterId]/complete/route.ts`
  3. `src/app/api/courses/[id]/chapters/[chapterId]/quiz/route.ts` (PUT handler)
  4. `src/app/api/courses/[id]/complete-level/route.ts`
  5. `src/app/api/courses/[id]/final-quiz/route.ts` (PUT handler)
- Fixed 4 frontend calls to pass userId via Authorization header:
  1. `FlameCounter.tsx` — GET /api/flames
  2. `Journey.tsx` — GET /api/flames
  3. `CourseViewer.tsx` — POST /chapters/.../complete
  4. `CourseViewer.tsx` — POST /complete-level
  5. `CourseViewer.tsx` — PUT /final-quiz
- Graceful fallback: when no userId is available, falls back to "main" (backward compatible for unauthenticated scenarios)

Stage Summary:
- Schema: Added `userId String?` to FlameTransaction model
- Auto-migrate: Added ALTER TABLE for FlameTransaction.userId column (PostgreSQL)
- Backend: All 13 occurrences of `id: "main"` replaced with `id: settingsId` (userId || "main")
- Backend: FlameTransaction.create calls now include `userId` field
- Backend: GET /api/flames now filters transactions per-user
- Frontend: All flame-related API calls now pass `Authorization: Bearer ${userId}` header
- New shared utility: `src/lib/get-user-id.ts` for consistent userId extraction across routes

---
Task ID: 3
Agent: fullstack-developer
Task: Fix quiz+level crash bugs (JSON.parse + missing array validation)

Work Log:
- Bug 1: `complete-level/route.ts` — `JSON.parse(progress.flameAwardedLevels)` could throw on malformed DB data
  - Wrapped in try/catch with fallback to empty array
  - Also added `Array.isArray()` guard for non-string, non-array values
- Bug 2a: `chapters/[chapterId]/quiz/route.ts` PUT handler — `answers` from request body used without validation
  - Added `if (!Array.isArray(answers))` check returning 400
  - Wrapped `JSON.parse(chapter.quiz.questions)` in try/catch returning 500 "Malformed quiz data"
- Bug 2b: `final-quiz/route.ts` PUT handler — same issues as 2a
  - Added `if (!Array.isArray(answers))` check returning 400
  - Wrapped `JSON.parse(course.finalQuiz.questions)` in try/catch returning 500 "Malformed quiz data"

Stage Summary:
- 3 files changed, 4 defensive guards added
- All `JSON.parse` calls on DB-stored JSON now have try/catch fallbacks
- Both quiz submission endpoints now validate `answers` is an array before processing
- No functional behavior changes for valid requests; only crash resilience improved
---
Task ID: 4
Agent: main
Task: Show "Start for Free" for new users on offers page instead of monthly/annual plans

Work Log:
- Read OffersPage.tsx, paywall-status API, paypal.ts, i18n.ts, store.ts to understand the full flow
- Identified that paywall-status API returns `trialCoursesGenerated` (0 for new users)
- Added `statusLoaded` state to prevent UI flash between loading and loaded states
- Added `showStartFree` computed boolean: `statusLoaded && trialCoursesGenerated === 0 && !isSubscribed`
- Created beautiful "Start for Free" card with emerald gradient, Sparkles icon, 3 feature bullets
- Card navigates to `setView("create")` when clicked (direct to course creation)
- Loading spinner shows while paywall status is being fetched
- After the free card, the pricing cards (monthly/annual) appear normally
- Hidden PayPal/payment notes when showing the free card
- Added 6 new i18n strings for both FR and EN (startFreeTitle, startFreeSubtitle, startFreeButton, startFreeNote, startFreeFeature1-3)
- Added `free-card-pulse` CSS animation (subtle emerald glow)
- Imported `Sparkles`, `BookOpen`, `Trophy` icons from lucide-react

Stage Summary:
- OffersPage.tsx: Added 3-way conditional rendering (loading → start free → pricing cards)
- i18n.ts: Added 6 FR + 6 EN translation keys for the "Start for Free" UI
- Verified via Agent Browser: FR and EN both show correct translations, button navigates to Create page
- Pushed to GitHub: 3da9535
