---
Task ID: 1
Agent: Main
Task: Comprehensive Coursia app fixes and features

Work Log:
- Analyzed entire Coursia project structure (40+ API routes, 46 UI components, Prisma schema, Zustand store, i18n system)
- Identified brand colors: primary=#7c5cbf (mauve), accent=#d4a843 (gold), gradient=mauve→gold

Stage Summary:
- Full understanding of codebase architecture achieved
- Key files identified: generate API, paywall-status, CreateCourse, CourseViewer, store, i18n

---
Task ID: 2
Agent: Main
Task: Fix CRITICAL free course abuse with atomic race-condition protection

Work Log:
- Replaced non-atomic check in generate API with db.$transaction that atomically reads freeCourseUsed and sets it to true BEFORE generation
- Removed course-count-based fallback (FREE_COURSE_LIMIT) — single source of truth is User.freeCourseUsed
- Changed fail-open (allow on DB error) to fail-closed (block on DB error) for security
- Removed redundant freeCourseUsed update in saveCourse() since it's now done atomically before generation

Stage Summary:
- Race condition eliminated via interactive Prisma transaction
- Free course flag is set atomically before any generation work begins
- If generation fails, the flag remains set (user can't retry free course — this is correct behavior)
- No course-count logic remains anywhere in the generation flow

---
Task ID: 3
Agent: Main
Task: Fix paywall-status API: Add freeCourseUsed, remove course-count logic, add 48h warning

Work Log:
- Rewrote paywall-status route to use freeCourseUsed as single source of truth
- Added freeCourseUsed boolean to PaywallStatus response
- Added expiryWarning48h boolean (true when subscription expires within 48 hours)
- Updated renewal urgency levels to include "48hours"
- Removed trialCoursesGenerated count-based logic from free user path
- Simplified decision tree: active sub → free user with freeCourseUsed=true → free user with freeCourseUsed=false

Stage Summary:
- PaywallStatus now includes freeCourseUsed and expiryWarning48h
- Clean separation: grace period check, active sub check, free user check
- 48h warning threshold = 48 * 60 * 60 * 1000 ms

---
Task ID: 4
Agent: Main
Task: Fix CreateCourse messages: First course free → Used free course + offers button

Work Log:
- Added localFreeCourseUsed state (synced from paywall-status API)
- Split message display into 3 states: Grace period, Free course used (with offers button), First course free badge
- Added GraduationCap icon import for the "used" card
- Updated paywall fetch to sync freeCourseUsed and expiryWarning48h to Zustand store
- After successful generation, immediately set localFreeCourseUsed=true to hide badge

Stage Summary:
- Three distinct message states, never shown simultaneously
- "Ton premier cours est gratuit" only shows when freeCourseUsed=false AND !hasSubscription
- "Tu as utilisé ton cours d'essai" shows with "Voir les offres" button when freeCourseUsed=true
- State updates immediately on generation success, not just on next page load

---
Task ID: 5
Agent: Main
Task: Add subscription notification system (48h warning, badge, banner)

Work Log:
- Added expiryWarning48h state to Zustand store
- Updated Sidebar to show red notification dot when expiryWarning48h is true
- Added 48h expiry warning banner to OffersPage
- Banner shows "Ton abonnement arrive bientôt à expiration" with 48h message
- Badge on "Offres" menu entry combines hasNotification and expiryWarning48h

Stage Summary:
- Red dot on sidebar "Offres" when subscription expires within 48h
- Warning banner on offers page during 48h window
- Badge disappears after renewal (paywall-status returns false)

---
Task ID: 6
Agent: Main
Task: Fix random topic diversity with persistent DB tracking

Work Log:
- Added UsedTopic model to Prisma schema (id, title, userId, createdAt, @@unique([title]))
- Pushed schema to database with prisma db push
- Rewrote /api/courses/random to use DB-persisted topic tracking
- Removed in-memory recentTopics cache
- Both AI-generated and fallback topics are persisted to DB
- Expanded fallback list from 30 to 50 topics

Stage Summary:
- Topics are tracked persistently across server restarts
- Unique constraint prevents duplicate tracking
- Fallback pool filters out DB-tracked topics
- AI prompt includes recently used topics to avoid repetition

---
Task ID: 7
Agent: Main
Task: Fix course generation persistence when user leaves page

Work Log:
- Removed the useEffect cleanup that aborted generation on unmount
- The API call continues in the background even if user navigates away
- Course is saved to DB; user can find it in their library when they return
- Double-click prevention (generatingRef) still works for new generations

Stage Summary:
- Course generation is no longer cancelled when user navigates away
- The API completes and persists the course regardless of frontend state

---
Task ID: 8
Agent: Main
Task: Fix course language bug (English selection generates French)

Work Log:
- Changed outline generation user prompt to use English when courseLang="en"
- The system prompt already had language instructions; the user prompt was always in French
- Now: courseLang="en" → "Design the detailed outline for a level X course..." 
- courseLang="fr" → "Conçois le plan détaillé du cours de niveau X..."

Stage Summary:
- Both system and user prompts now consistently reflect the target language

---
Task ID: 9
Agent: Main
Task: Fix Suivant animation bug

Work Log:
- Added unique key prop to fullscreen mode markdown content div
- Changed key from absent to `key={fs-chapter-${currentChapter.id}-${currentChapterIndex}}`
- Also updated normal mode key to include currentChapterIndex

Stage Summary:
- Animations now re-trigger on every chapter navigation in both fullscreen and normal modes

---
Task ID: 10
Agent: Main
Task: Implement level quiz system (7 questions, 4/7 pass, second chance, +1pt/correct)

Work Log:
- Created /api/courses/[id]/level-quiz/route.ts (POST generates 7 Qs, PUT submits answers)
- Quiz uses AI to generate questions from chapter content, with fallback questions
- In-memory cache prevents duplicate questions on second attempt
- Created LevelQuizPanel component in CourseViewer.tsx
- Modified handleCompleteLevel to show quiz before level-up screen
- Quiz: 7 questions, 4/7 to pass, +1 flame point per correct answer
- Failed first attempt → retry with different questions
- Failed second attempt → still proceed (user always moves on)
- Added handleLevelQuizComplete callback with celebration on pass

Stage Summary:
- Full level quiz flow: complete all chapters → quiz → pass/retry → continue
- Points awarded via FlameTransaction and AppSettings
- Different questions on retry attempt via server-side cache avoidance