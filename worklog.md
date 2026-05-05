---
Task ID: 1
Agent: Main
Task: Implement Points de Flamme system, study time tracking, hover glow effects, and payment gate

Work Log:
- Updated Prisma schema: added StudySession model, hasSubscription field to AppSettings
- Pushed schema to SQLite database with db:push
- Made flame earning harder: score must be >= 80 to earn points, formula reduced to score * 0.15 (max ~15 per chapter)
- Added calculateCourseCompletionBonus: scales from 30 (at 60%) to 75 (at 100%)
- Updated final quiz route to use new harder bonus calculation
- Created FlameCounter.tsx: floating top-left component with animated flame points, click to open flame details panel
- Added hasSubscription to /api/flames response
- Removed flame points card from Journey.tsx (moved to floating counter)
- Replaced study time stat card with interactive study time tracking (today, 3 days, week, month)
- Created /api/study-time endpoint: GET for stats, POST for session start/end
- Added study session tracking to CourseViewer: starts when viewing chapter, ends when navigating away
- Added hover glow CSS effect (.card-hover-glow) with scale + soft light
- Updated all Journey page cards with card-hover-glow class and per-card glow colors
- Added payment gate: flame system only active when hasSubscription=false
- Updated CreateCourse: hides flame cost if user has subscription
- Updated generate route: skips flame spending if user has subscription
- Added i18n translations for study time (FR/EN): today, 3 days, week, month, detail panel
- Built production bundle successfully
- Started production server with auto-restart loop

Stage Summary:
- Flame points now appear as floating counter in top-left corner of screen (not landing page)
- Clicking the counter opens flame details panel with tiers, rewards, and activity
- Flame earning is significantly harder: require 80%+ quiz score, reduced point values
- Study time tracked per chapter view, displayed in Journey with clickable time periods
- Hover glow effect on all cards in Journey page
- Payment gate: hasSubscription flag controls whether flame points are required
- Production server running on port 3000 with auto-restart
