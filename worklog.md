---
Task ID: 1
Agent: Main Agent
Task: Course sharing fixes — remove "Partager par lien", fix user search, add profile photo upload

Work Log:
- Analyzed uploaded screenshot to understand current UI state
- Explored codebase to find all sharing-related files (ShareCourseDialog, search API, shares API, etc.)
- Read all key files: ShareCourseDialog.tsx, Sidebar.tsx, AppShell.tsx, store.ts, auth routes, Prisma schema
- Removed entire "Partager par lien" section (Section 3) from ShareCourseDialog.tsx including link copy, social sharing buttons, and all related state/imports
- Fixed user search API (/api/users/search) to use case-insensitive raw SQL with LOWER() for SQLite compatibility across firstName, lastName, email, username
- Added avatar field to Prisma User model and ran db:push
- Created new API route /api/users/avatar for profile photo upload (accepts JPEG/PNG/WebP/GIF, max 2MB)
- Updated UserData interface in store.ts to include optional avatar field
- Updated login route to return avatar field in user response
- Updated auth/me route (POST + GET) to include avatar in buildSafeUser and Prisma/raw SQL queries
- Updated Sidebar component: replaced generic User icon with avatar image + camera overlay on hover for photo upload
- Updated AppShell MobileSlideOver: same avatar click-to-upload functionality
- Updated shares list API to include avatar and username in shared user data
- Updated ShareCourseDialog to display avatar images in search results, selected friend, and shared-with list
- Fixed duplicate toast import in AppShell.tsx

Stage Summary:
- "Partager par lien" section completely removed from share dialog
- User search now works with case-insensitive matching across all fields (name, email, pseudo)
- Profile photo upload working: click avatar in sidebar → file picker → upload → display
- Avatar shown in search results and shared-with list (falls back to gradient initial)
- All changes verified via browser testing with agent-browser
- Files modified: ShareCourseDialog.tsx, Sidebar.tsx, AppShell.tsx, store.ts, schema.prisma, users/search/route.ts, users/avatar/route.ts, courses/[id]/shares/route.ts, auth/login/route.ts, auth/me/route.ts, auth/register/route.ts

---
Task ID: 2
Agent: Animation Agent
Task: Premium scroll-reveal animations, parallax, micro-interactions, and mobile responsive fixes

Work Log:
- Removed all 8 individual visibility states (heroVisible, featuresVisible, audienceVisible, diffVisible, exploreVisible, pricingVisible, faqVisible, ctaVisible) and their corresponding refs
- Kept heroVisible state for typewriter effect and floating cards framer-motion animations
- Removed unused useRef import
- Replaced the old IntersectionObserver (which observed specific IDs) with a new single observer that queries `.lp-section` elements and adds `revealed` CSS class on intersection (once-only, unobserve after reveal)
- Added parallax scroll effect using requestAnimationFrame + passive scroll listener for hero-glow and hero-grid background elements
- Added `lp-section` class to all 8 sections (hero, features, audience, diff, explore, pricing, faq, final-cta)
- Added `lp-stagger` class with staggered transitionDelay (0ms, 150ms, 300ms, 450ms) to all child elements within each section
- Hero section: badge 0ms, h1 150ms, subtitle 300ms, CTA 450ms
- Other sections: title container 0ms, content grid 150ms, secondary elements 300ms
- Added premium CSS animation system: `.lp-stagger` with translateY(50px) scale(0.98) initial state, 0.8s cubic-bezier(0.16, 1, 0.3, 1) transition, and `.revealed .lp-stagger` final state
- Added `prefers-reduced-motion: reduce` media query to disable animations for accessibility
- Enhanced `.glass` card hover with premium cubic-bezier transitions for transform, box-shadow, and border-color
- Added `id="hero-glow"` to the top purple glow div and `id="hero-grid"` to the grid overlay for parallax targeting
- Added `overflow-x-hidden` to root container div to prevent horizontal scroll on mobile
- Added `overflow-hidden` to floating cards container, explore courses grid container
- All existing CSS keyframes and animations preserved (aurora, pricing shimmer, hero CTA glow, floating particles, etc.)
- All existing content, JSON-LD, typewriter, framer-motion floating cards, and footer preserved unchanged
- Fixed bug: explore section was never observed in the old code (missing from observer ID list), now automatically observed via `.lp-section` selector

Stage Summary:
- Replaced state-based visibility system with CSS class-based scroll reveal (95 insertions, 125 deletions)
- All 8 sections now have staggered reveal animations with premium easing
- Parallax effect on hero background (glow + grid) via scroll + rAF
- Glass cards have enhanced micro-interaction hover transitions
- Mobile responsive fixes: overflow-x-hidden on root, overflow-hidden on grids
- No lint errors in src/, no console errors in browser
- Files modified: src/components/coursia/LandingPage.tsx
- Pushed to GitHub: commit 9439152
