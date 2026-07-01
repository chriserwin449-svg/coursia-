# Coursia — Architecture

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.1 |
| UI Library | React | 19 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 4 |
| Components | shadcn/ui (New York) | latest |
| Animations | Framer Motion | 12.23.2 |
| State | Zustand | 5.0.6 |
| Database | SQLite (libSQL) | via Prisma 6 |
| ORM | Prisma | 6.11.1 |
| Auth | NextAuth | 4.24.11 |
| Payments | PayPal SDK | custom integration |
| AI | z-ai-web-dev-sdk | 0.0.17 |
| AI Fallback | Groq / Gemini / OpenAI | via smartChatCompletion |
| Analytics | Vercel Analytics + Speed Insights | 2.0.x |
| Icons | Lucide React | 0.525.0 |
| i18n | Custom (FR/EN) | src/lib/i18n.ts |

## Entry Point

```
src/app/page.tsx → <AppShell />
```

AppShell is a client-side SPA controller that renders views based on Zustand `view` state.

## Navigation Views

```
view === "landing"   → <LandingPage />        (public)
view === "auth"      → <AuthPage />           (public)
view === "create"    → <CreateCourse />       (auth required)
view === "library"   → <LibraryPage />        (auth required)
view === "viewer"    → <CourseViewer />       (auth required)
view === "journey"   → <Journey />            (auth required)
view === "offers"    → <OffersPage />         (auth required)
```

Layout for authenticated views: Sidebar + TopBar + Main Content + MobileBottomNav

## File Structure

```
src/
├── app/
│   ├── page.tsx                    # Main entry → AppShell
│   ├── layout.tsx                  # Root layout (fonts, toaster, analytics)
│   ├── globals.css                 # Theme variables, animations, glass effects
│   └── api/
│       ├── auth/                   # 7 routes (register, login, me, session, etc.)
│       ├── courses/                # 10 routes (CRUD, generate, quiz, progress)
│       ├── subscription/           # 10 routes (checkout, capture, webhook, admin)
│       ├── flames/                 # 3 routes (balance, progression, decay)
│       ├── study-time/             # 1 route
│       ├── badges/                 # 1 route
│       └── ...misc                 # DB status, AI status, PayPal config
├── components/
│   ├── coursia/                    # 19 app components
│   │   ├── AppShell.tsx            # Root SPA controller
│   │   ├── LandingPage.tsx         # Marketing page
│   │   ├── AuthPage.tsx            # Login/Register
│   │   ├── CreateCourse.tsx        # Course creation form
│   │   ├── Library.tsx             # Course library
│   │   ├── CourseViewer.tsx        # Chapter reader + quiz
│   │   ├── Journey.tsx             # Stats/badges
│   │   ├── OffersPage.tsx          # Pricing page
│   │   ├── Sidebar.tsx             # Desktop nav
│   │   ├── TopBar.tsx              # Top bar
│   │   └── ...
│   └── ui/                         # 42 shadcn/ui components
├── hooks/
│   ├── useSession.ts               # Session restoration
│   ├── useSubscriptionStatus.ts    # Subscription polling
│   ├── usePlan.ts                  # Plan helpers
│   ├── use-mobile.ts               # Viewport detection
│   └── use-toast.ts                # Toast notifications
├── lib/
│   ├── store.ts                    # Zustand global state
│   ├── constants.ts                # App constants
│   ├── i18n.ts                     # FR/EN translations (769 lines)
│   ├── db.ts                       # Prisma client singleton
│   ├── auth.ts                     # NextAuth config
│   ├── openai.ts                   # AI provider routing
│   ├── paypal.ts                   # PayPal SDK integration
│   ├── analytics.ts                # Event tracking
│   ├── flames.ts                   # Gamification logic
│   ├── badges.ts                   # Badge logic
│   └── utils.ts                    # cn() helper, etc.
└── types/
    └── next-auth.d.ts              # NextAuth type augmentation
```

## Database Models (Prisma/SQLite)

| Model | Key Fields | Relations |
|-------|-----------|-----------|
| User | id, email, password, firstName, lastName, subscriptionPlan, subscriptionStatus, subscriptionStartDate/EndDate | → PaymentRequest[] |
| PaymentRequest | id, userId, plan, amount (cents), currency, status, txRef | ← User |
| AppSettings | id ("main"), flamePoints | singleton |
| FlameTransaction | id, amount, reason, courseId?, chapterId? | log |
| Course | id, userId?, title, description, sourceLinks (JSON), level, flameCost | → Chapter[], CourseQuiz, CourseProgress, StudySession[] |
| Chapter | id, title, content, summary, order, level, courseId | ← Course, Quiz, ChapterProgress |
| Quiz | id, questions (JSON), chapterId | ← Chapter |
| ChapterProgress | id, chapterId, completed, score, completedAt, flameAwarded | ← Chapter |
| CourseQuiz | id, questions (JSON), courseId | ← Course |
| CourseProgress | id, courseId, completed, score, maxUnlockedLevel, stoppedAtLevel | ← Course, → StudySession[] |
| StudySession | id, userId?, chapterId?, courseId, startTime, endTime, durationSeconds | ← Course, ← CourseProgress |

## Zustand Store (State Groups)

| Group | Key Fields |
|-------|-----------|
| Language | lang (fr/en), setLang |
| Auth | user, authToken, isAuthenticated, userId, userEmail, setUser, logout |
| Navigation | view (7 views), selectedCourseId, currentChapterIndex, isFullscreen |
| UI | isGenerating, showQuiz, showFinalQuiz, showCelebration, sidebarCollapsed |
| Random | randomTopic, randomCourseLang |
| Subscription | userPlan, hasSubscription, subscriptionStatus |
| Trial | inTrial, trialDaysRemaining, trialCoursesGenerated |
| Grace | inGracePeriod, graceDaysRemaining |
| Renewal | showRenewalReminder, renewalDaysRemaining |
| Notifications | hasNotification, notificationDismissed |

## Design System

### Brand Colors
- **Night** (#0d0d1a) — Primary background
- **Mauve** (#7c5cbf) — Primary brand color
- **Gold** (#d4a843) — Accent / premium

### Key CSS Effects
- `.glass` — Night-light bg + backdrop-blur + mauve border
- `.gradient-text` — Mauve → Gold (135deg)
- `.glow-mauve`, `.glow-gold` — Box shadow glow
- Custom scrollbar (6px, mauve-tinted)

## Auth Flow

1. User registers via `/api/auth/register` (bcrypt password hash)
2. Server returns userId + token
3. Client stores: `localStorage("coursia-auth-token")` + `localStorage("coursia-user-data")`
4. On page load, `useSession()` hook calls `POST /api/auth/me` to validate
5. All API routes accept userId via `Authorization: Bearer <userId>` header or query param

## Payment Flow

1. User clicks plan → `POST /api/subscription/checkout` → PayPal order created
2. Frontend redirects to `approveUrl` (PayPal hosted checkout)
3. PayPal returns with `?payment=success&plan=X&request_id=Y`
4. AppShell detects URL params → `POST /api/subscription/capture`
5. Server captures payment → updates User.subscriptionStatus to "active"

## Free Tier

- 1 free course (FREE_COURSE_LIMIT = 1)
- 1 free chapter readable per course (FREE_CHAPTER_LIMIT = 1)
- After 1 course: paywall blocks generation, shows offers page
- Subscription plans: Monthly $9.99, Annual $42.99 (64% savings)