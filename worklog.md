---
Task ID: 1
Agent: Main Agent
Task: Fix preview, remove logo/images, fix auth, fix OpenAI, flame bar, study time, sub-chapters

Work Log:
- Analyzed all project files (lib, components, API routes, hooks)
- Fixed store.ts: added missing properties (isAuthenticated, userName, userId, userEmail, logout, userPlan, planFeatures, setUserPlan)
- Fixed i18n.ts: added missing `common` and `paywall` translation sections (FR + EN)
- Fixed useSession.ts: changed from non-existent /api/auth/session to /api/auth/me, fixed setUser signature
- Fixed Sidebar.tsx: safe lastName.charAt access
- Fixed PaywallModal.tsx: benefitIcons bounds check
- Fixed CourseViewer.tsx: removed course! non-null assertions, fixed sendBeacon Content-Type
- Fixed openai.ts: wrapped z-ai fallback in try/catch
- Fixed ai-status API: added error handling
- Fixed courses API: safe JSON.parse for sourceLinks and quiz questions
- Fixed db.ts: reduced Prisma logging overhead
- Fixed use-toast.ts: TOAST_REMOVE_DELAY from 16min to 5s
- Fixed AuthPage.tsx: persist userData to localStorage
- Removed CoursiaLogo from LandingPage, AuthPage, Sidebar, CourseViewer
- Replaced avatar images with colored circles with initials
- Fixed auth/me to validate tokens deterministically
- Fixed auth/login and auth/register with deterministic tokens
- Created auth/signout route
- Moved flame bar just above the 3 stat boxes (mb-8 → mb-3)
- Added hover effects (scale, glow, translate) on 3 stat boxes
- Added click handlers on stat boxes (library, flame collection, study detail)
- Updated useSession to send userId with token

Stage Summary:
- 0 TypeScript errors in src/
- 0 ESLint errors
- Authentication properly secured with deterministic tokens
- Logo and profile images removed (temporarily)
- Flame bar repositioned above 3 stat cards
- Hover/click effects on stat boxes
- Study time tracking works via start/end sessions
- Chapter unlock mechanism already functional (lock icon + isChapterUnlocked)
- Sub-chapters are the H2 sections within each chapter's Markdown content
- OpenAI integration verified working (sk-svcacct key supported)
