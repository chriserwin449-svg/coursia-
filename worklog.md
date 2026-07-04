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
