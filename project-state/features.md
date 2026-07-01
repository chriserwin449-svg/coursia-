# Coursia — Features

## Core Features

### 1. AI Course Generation ✅
- Multi-step pipeline: web search → outline → chapters → quality check
- 4 parallel web search queries for depth
- Source link scraping support (up to 3 links)
- 3 difficulty levels: Beginner, Intermediate, Advanced
- Bilingual: French & English
- Server-side retry with exponential backoff
- Client-side retry (3 attempts, 1s/2s backoff) + DB recovery
- Progress messages: "Préparation..." → "Génération..." → "Finalisation..."
- Fallback: single-call generation if outline→chapters fails
- Max 120s server timeout (Vercel maxDuration)
- **Files:** `src/app/api/courses/generate/route.ts`, `src/components/coursia/CreateCourse.tsx`

### 2. Course Viewer ✅
- Chapter-by-chapter reading with Markdown rendering
- Syntax highlighting for code blocks
- Chapter completion tracking
- Per-chapter quizzes (auto-generated)
- Final course quiz
- Fullscreen reading mode
- Progress bar
- **Files:** `src/components/coursia/CourseViewer.tsx`

### 3. Level Progression ✅
- 3 difficulty levels per course (beginner → intermediate → advanced)
- Each level generates new harder content
- Level review system (stop/review)
- `maxUnlockedLevel` tracking in CourseProgress
- **Files:** `src/app/api/courses/[id]/generate-level/route.ts`, `CourseViewer.tsx`

### 4. Subscription & Payments ✅
- PayPal redirect flow (no inline buttons)
- 2 plans: Monthly ($9.99) / Annual ($42.99)
- Rate limiting: 3 attempts per 60s per user
- Payment request records in DB
- Capture flow on return from PayPal
- Grace period: 3 days after expiry
- Renewal reminders with urgency levels (1month → last24hours)
- Countdown timer for last 24h
- **Files:** `src/app/api/subscription/`, `src/components/coursia/OffersPage.tsx`

### 5. Free Tier ✅
- 1 free course per user (no credit card)
- 1 free chapter readable per course
- "Ton premier cours est gratuit !" badge on create page
- Automatic paywall after free limit
- **Files:** `src/app/api/courses/paywall-status/route.ts`, `CreateCourse.tsx`

### 6. Gamification (Flames) ✅
- Flame points earned on chapter completion and quiz passing
- Flame counter in TopBar
- Flame transaction logging
- Decay mechanism
- **Files:** `src/lib/flames.ts`, `src/app/api/flames/`

### 7. Badges & Achievements ✅
- Badge system for milestones
- Displayed in Journey page
- **Files:** `src/lib/badges.ts`, `src/app/api/badges/route.ts`

### 8. Learning Journey ✅
- Stats dashboard: courses, chapters, quizzes, flames, streak, time
- Badge showcase
- Recent courses
- **File:** `src/components/coursia/Journey.tsx`

### 9. Course Library ✅
- Grid/list view of created courses
- Progress indicators
- Delete support
- Continue reading
- **File:** `src/components/coursia/Library.tsx`

### 10. Random Topic ✅
- AI-powered random topic suggestion
- Auto-fills title + forces beginner level
- Button in TopBar
- **Files:** `src/app/api/courses/random/route.ts`, `src/components/coursia/TopBar.tsx`

### 11. Landing Page ✅
- Hero section with CTA
- Features showcase (AI, badges, quiz)
- How it works section
- Pricing preview
- FAQ accordion
- Responsive design
- **File:** `src/components/coursia/LandingPage.tsx`

### 12. Auth (Login/Register) ✅
- Email + password registration (bcrypt)
- Email + password login
- Session restoration via localStorage + API validation
- Logout with state cleanup
- **Files:** `src/app/api/auth/`, `src/components/coursia/AuthPage.tsx`

### 13. Bilingual (FR/EN) ✅
- Full French/English support
- Language toggle in TopBar
- Persisted to localStorage
- 769 lines of translations
- **File:** `src/lib/i18n.ts`

### 14. Responsive Design ✅
- Mobile-first with Tailwind breakpoints
- Desktop: Sidebar + TopBar
- Mobile: Bottom nav bar (4 tabs)
- Touch-friendly targets (44px minimum)
- **Files:** `src/components/coursia/Sidebar.tsx`, `src/components/coursia/TopBar.tsx`

### 15. Study Time Tracking ✅
- Track time spent per chapter/course
- StudySession records in DB
- **Files:** `src/app/api/study-time/route.ts`

## UI/UX Features

### 16. Glass Morphism Theme ✅
- Dark theme (night background)
- Glass cards with backdrop-blur
- Mauve + Gold brand colors
- Gradient text effects
- Custom scrollbar
- **File:** `src/app/globals.css`

### 17. Animations ✅
- Framer Motion page transitions
- Typing placeholder animation (CreateCourse)
- Confetti celebration
- Flame bar effects (8 keyframes)
- Card hover effects
- Floating pricing cards
- Gold shimmer on annual plan
- **Various files**

### 18. Notification System ✅
- Renewal reminder dot in sidebar
- Paywall notification
- Toast notifications (sonner)
- **Files:** `AppShell.tsx`, store notification state

### 19. Error Recovery ✅
- Course generation: DB recovery check after failed attempts
- Payment: silent cancel handling, no false errors
- Offline banner component
- **Files:** `CreateCourse.tsx`, `OffersPage.tsx`, `OfflineBanner.tsx`

## Infrastructure

### 20. Domain & Hosting ✅
- Domain: coursia.io
- DNS: A record + CNAME → Vercel
- Vercel deployment with auto-SSL

### 21. Analytics ✅
- Vercel Analytics
- Vercel Speed Insights
- Custom event tracking
- **File:** `src/lib/analytics.ts`

## Communication

### 22. Feedback Widget (Crisp-like) ✅
- Floating purple button (bottom-right, all pages)
- Expandable panel with glass morphism design
- 4 feedback types: Bug, Idea, Question, General
- Subject + message + optional email
- Email field auto-hidden for authenticated users
- Success animation with auto-close (2.5s)
- Server-side: input validation, metadata capture (userAgent, timestamp)
- DB model: Feedback (id, userId, type, subject, message, email, page, metadata, status)
- **Files:** `src/components/coursia/FeedbackWidget.tsx`, `src/app/api/feedback/route.ts`, `prisma/schema.prisma`