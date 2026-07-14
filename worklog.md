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
---
Task ID: 5
Agent: main
Task: Fix OffersPage layout — keep both pricing cards + add 'Start for Free' below, change landing page buttons

Work Log:
- User clarified: keep both Monthly/Annual cards ALWAYS visible on OffersPage
- Add "Commencer gratuitement" banner BELOW the two cards (only for new users with 0 courses)
- Removed the previous approach that replaced pricing cards with a single free card
- Changed landing page pricing buttons ("Choisir Mensuel", "Choisir Annuel") from `setView("offers")` to `setView("create")`
- Removed unused imports (BookOpen, Trophy) and free-card-glow CSS animation
- Fixed missing `</div>` that caused JSX parsing error (grid container wasn't closed)

Stage Summary:
- OffersPage.tsx: Both pricing cards always visible, "Commencer gratuitement" banner appears below for new users
- LandingPage.tsx: Pricing CTA buttons now navigate to Create page
- Verified via Agent Browser: both cards visible, free banner below, all buttons navigate correctly
- Pushed to GitHub: db1d085

---
Task ID: 1
Agent: Main Agent
Task: Replace "Choisir Mensuel/Annuel" buttons with "Commencer gratuitement" for new users on both Offers and Landing pages

Work Log:
- Read and analyzed OffersPage.tsx and LandingPage.tsx current state
- Removed the `!statusLoaded` loading gate that hid the pricing grid on OffersPage
- Removed the green "Essaie d'abord, décide après" banner from OffersPage
- Added `showStartFree` conditional button rendering on both monthly and annual pricing cards in OffersPage — when true, buttons show "Commencer gratuitement" with Sparkles icon and emerald gradient, onClick navigates to Create page (or Auth if not logged in)
- Added `showStartFree` state + paywall-status fetch to LandingPage for authenticated users (defaults to true for visitors)
- Changed LandingPage top-right nav button from "Essayer Gratuitement" (tx.landing.cta) to "Commencer gratuitement" (tx.landing.startFree)
- Changed both LandingPage pricing card buttons to conditionally show "Commencer gratuitement" with emerald gradient for new users
- Fixed lint error (avoided setState in effect when not needed)
- Verified with browser: all buttons correctly show "Commencer gratuitement", clicking navigates to Auth page for unauthenticated users

Stage Summary:
- OffersPage.tsx: Buttons change from "Choisir Mensuel/Annuel" → "Commencer gratuitement" for new users (trialCoursesGenerated === 0 && !isSubscribed), removed green banner, removed loading gate
- LandingPage.tsx: Top-right button "Essayer Gratuitement" → "Commencer gratuitement", pricing buttons conditionally show "Commencer gratuitement" for new users, added paywall-status fetch
- All verified via browser snapshot (agent-browser) — landing page shows correct button text

---
Task ID: 2
Agent: Main Agent
Task: Multiple UI fixes — landing page buttons, hero text, badge text, first-course-free message, PayPal spacing

Work Log:
- Removed `showStartFree` state/effect from LandingPage.tsx, restored original "Choisir Mensuel"/"Choisir Annuel" buttons with shimmer animations
- Removed trailing "." from hero heading (no longer needed since new text ends with "?")
- Updated i18n FR hero: "Chaque personne apprend différemment." + "Pourquoi suivre le même cours que tout le monde ?"
- Updated i18n FR subtitle: "Avec Coursia, l'IA construit un parcours d'apprentissage entièrement personnalisé pour toi..."
- Updated i18n EN hero/subtitle with English equivalents
- Changed annual badge from "Le plus populaire" to "Le plus économique sur le long terme" (FR) / "Most cost-effective in the long run" (EN)
- Fixed "Ton premier cours est gratuit !" in CreateCourse.tsx: changed `canCreateCourse` initial state to `false`, added `paywallLoaded` state, only show badge after API confirms user can create
- Fixed PayPal text spacing on Offers page: added `mt-10` to bottom note container

Stage Summary:
- Landing page pricing cards now show original purple/gold "Choisir Mensuel"/"Choisir Annuel" buttons
- Hero text updated to "Chaque personne apprend différemment. Pourquoi suivre le même cours que tout le monde ?"
- Annual badge changed to "Le plus économique sur le long terme"
- "Ton premier cours est gratuit" will no longer flash or reappear after first course
- PayPal text no longer sticks to annual card
---
Task ID: 6
Agent: general-purpose
Task: Overhaul flames system with new point rules + study time rewards

Work Log:
- Read all 6 target files + Prisma schema + auto-migrate.ts to understand current flame logic
- Current system: chapter quiz gave 15-50 flames (scaled by level), level completion gave 50-150, mastery gave 500
- Replaced variable flame calculations with fixed constants in `src/lib/flames.ts`:
  - `CHAPTER_COMPLETE_FLAMES = 2` (was 15-50 via calculateFlameEarned)
  - `LEVEL_COMPLETE_FLAMES = 6` (was 50-150 via calculateLevelCompletionBonus)
  - `COURSE_MASTERY_FLAMES = 10` (was 500 via calculateMasteryBonus)
  - `STUDY_TIME_GOOD_FLAMES = 3`, `STUDY_TIME_SHORT_PENALTY = -1`
  - `STUDY_TIME_GOOD_THRESHOLD = 600` (10 min), `STUDY_TIME_SHORT_THRESHOLD = 120` (2 min)
- Updated `quiz/route.ts` PUT handler: replaced `calculateFlameEarned(score)` with `CHAPTER_COMPLETE_FLAMES` (fixed +2)
- Updated `complete/route.ts`: replaced `calculateFlameEarned(100, courseLevel)` with `CHAPTER_COMPLETE_FLAMES` (fixed +2)
- Updated `complete-level/route.ts`: replaced `calculateLevelCompletionBonus(level)` with `LEVEL_COMPLETE_FLAMES` (+6), `calculateMasteryBonus()` with `COURSE_MASTERY_FLAMES` (+10). Also removed now-unnecessary `@ts-expect-error` directives.
- Added `flameAwarded Boolean @default(false)` to StudySession model in Prisma schema
- Added auto-migration for `flameAwarded` column on StudySession table (PostgreSQL)
- Overhauled `study-time/route.ts` end action with study time flame rewards:
  - >= 600 seconds (10 min): +3 flames, reason "study_time_good"
  - < 120 seconds (2 min): -1 flame, reason "study_time_short" (never goes below 0 total)
  - 2-10 min range: no change (neutral)
  - Uses `flameAwarded` flag on StudySession to ensure only awarded once per session
  - Creates FlameTransaction for audit trail
- Updated `CourseViewer.tsx` to pass `userId` in all 3 places that end study sessions (endStudySession callback, cleanup useEffect, beforeunload handler) so the study-time API can attribute flames correctly
- Kept `calculateCourseCompletionBonus` and `calculateFlameEarned` functions in flames.ts (still used by final-quiz route and for backward compatibility)
- TypeScript verified: no new errors in any modified file

Stage Summary:
- 7 files changed: quiz/route.ts, complete/route.ts, complete-level/route.ts, study-time/route.ts, flames.ts, auto-migrate.ts, CourseViewer.tsx, schema.prisma
- New flame economy: chapter +2, level +6, all-levels bonus +10, good session +3, short session -1 (min 0)
- Study time rewards fully integrated into session end flow with duplicate protection via `flameAwarded` flag
- All changes use existing FlameTransaction model for logging
---
Task ID: 5
Agent: general-purpose
Task: Fix next chapter double-click bug

Work Log:
- Read worklog.md and analyzed CourseViewer.tsx (~1400 lines) to understand the chapter navigation system
- Identified the `goToNext` async callback (line 356) which handles "Next Chapter" button clicks
- Root cause: `goToNext` called `setCurrentChapterIndex(nextIdx)` AFTER awaiting `completeCurrentChapter()`. The async API call (POST /complete + GET /courses) introduced a delay before the chapter actually advanced in the UI. During this delay, the component re-rendered with `isCompleting=true` (showing a spinner) but the chapter index hadn't changed yet, making it appear as if the first click did nothing.
- Fix: Moved `setCurrentChapterIndex(nextIdx)` to execute IMMEDIATELY (before the await), so the chapter advances on the first click with instant visual feedback. The chapter completion API call now runs in the background without blocking navigation.
- Also removed the `if (!success) { setIsCompleting(false); return; }` early-exit since the chapter has already advanced — if completion fails, the user is still on the correct next chapter.
- Added `if (success)` guard around celebration code so confetti/celebration only shows when completion actually succeeds.
- Pre-existing TS errors on lines 76-77 (useRef without initial value) confirmed unrelated to this change.

Stage Summary:
- CourseViewer.tsx: Restructured `goToNext` to advance `currentChapterIndex` synchronously before the async `completeCurrentChapter()` call
- Single click now immediately navigates to the next chapter; completion + celebration happen in background
- No other functionality changed (sidebar nav, prev button, keyboard nav, level completion all unaffected)
