# Coursia — Changelog

All changes are logged here chronologically. Each entry includes date, files modified, and description.

---

## 2025-06-30 — Feedback Widget + Project State

### Added: Project State Documentation
- Created `project-state/` folder for persistent project documentation
- `README.md` — Overview and quick stats
- `architecture.md` — Full tech stack, file structure, DB models, auth/payment flows
- `features.md` — All 21 features with status and file references
- `changelog.md` — This file

### Added: Crisp-like Feedback Widget
- **New DB model:** `Feedback` (id, userId, type, subject, message, email, page, metadata, status, createdAt)
- **New API routes:**
  - `POST /api/feedback` — Submit feedback
- **New component:** `FeedbackWidget.tsx` — Floating chat bubble, expandable form
- **Integration:** Added to `AppShell.tsx` for all authenticated users
- **Feedback types:** bug_report, feature_request, question, general
- **Files:** `prisma/schema.prisma`, `src/app/api/feedback/route.ts`, `src/components/coursia/FeedbackWidget.tsx`

---

## 2025-06-30 — Payment & Generation Reliability Fixes

### Fixed: Course Generation Reliability (Issue 1)
- **Root cause:** No client-side retry, no payload validation, generic errors
- **Changes in `CreateCourse.tsx`:**
  - Retry logic: 3 attempts with exponential backoff (1s → 2s)
  - Progress messages cycling every 8s (Preparing → Generating → Finalizing)
  - Payload validation (level 0-2, language fr/en)
  - DB recovery check between retries (avoids duplicate courses)
  - Empty/null AI response handling
  - Better error messages in FR/EN
  - Fixed bug: `data.plan || level` referenced undefined variable

### Fixed: Payment Redirect UX (Issue 2)
- **Root cause:** Error messages shown during active redirect, no loading indication
- **Changes in `OffersPage.tsx`:**
  - "Redirecting to secure checkout..." banner during checkout
  - Button text changes to "Redirection..." during loading
  - Error only shows when `!loadingPlan` (prevents false errors)
  - Double-click prevention maintained

### Added: First Course Free Feature
- "🎁 Ton premier cours est gratuit !" badge on CreateCourse
- Shows when user has no subscription and can still create
- System already allowed 1 free course (FREE_COURSE_LIMIT = 1)
- After 1 course, paywall blocks second course

### Files modified:
- `src/components/coursia/CreateCourse.tsx`
- `src/components/coursia/OffersPage.tsx`

---

## 2025-06-30 — Landing Page & Premium Skills

### Created: Premium Skills (3 files in `skills/`)
- `skills/ui-ux-pro-max/SKILL.md` — Self-improvement loop, quality checklist
- `skills/senior-frontend-engineer/SKILL.md` — Spacing, typography, easing, Framer Motion
- `skills/premium-ux-animator/SKILL.md` — Animation timing, CSS animations, scroll reveals

### Kept: Landing page unchanged
- User said "retour" / "non pas besoin laisse comme avant"
- Landing page design preserved as-is

---

## 2025-06-30 — Domain Setup (coursia.io)

### Added: DNS Configuration
- A record: `@` → Vercel IP
- CNAME: `www` → `cname.vercel-dns.com`
- Domain active on coursia.io

---

## 2025-06-30 — Payment Bug Fixes

### Fixed: UUID Validation Regex
- Changed `^[a-z0-9]+$` to `^[a-z0-9-]+$` to allow UUID dashes
- **Files:** checkout/route.ts, verify-card/route.ts, confirm/route.ts

### Fixed: PayPal Cancel Error
- Removed error message when user cancels PayPal payment
- **File:** `OffersPage.tsx`

### Fixed: Course Generation Double-Click
- Added `maxDuration = 120` for Vercel serverless
- Added client-side DB recovery on timeout
- **Files:** generate/route.ts, CreateCourse.tsx

### Fixed: Landing Page CTA Buttons
- Removed gradients, glow effects, Sparkles icon
- Simple `border border-border text-foreground` with hover
- **File:** `LandingPage.tsx`

---

## Before 2025-06-30 — Initial Development

### Core Platform Built
- Next.js 16 + React 19 + TypeScript 5 setup
- Prisma + SQLite database with 10 models
- NextAuth 4 authentication
- Zustand v5 state management
- Tailwind CSS 4 + shadcn/ui component library
- Bilingual i18n (FR/EN) — 769 lines
- PayPal payment integration
- AI course generation pipeline (z-ai-web-dev-sdk)
- All 19 Coursia components
- All 30 API routes
- Landing page, auth, create, library, viewer, journey, offers
- Gamification (flames, badges)
- Responsive design (mobile + desktop)
- Glass morphism theme (night/mauve/gold)