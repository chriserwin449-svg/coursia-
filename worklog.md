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
