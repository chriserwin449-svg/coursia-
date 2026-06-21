---
Task ID: 1
Agent: Main Agent
Task: Change app language to English (default) with French toggle button

Work Log:
- Explored entire codebase i18n architecture: found custom `t()` function with FR/EN translations in `src/lib/i18n.ts`, Zustand store with `lang` state, and consistent `tx.*` pattern across components
- Identified ~87 inline `isFr ? "fr" : "en"` ternaries across 8 component files (all already have EN translations, just not centralized in i18n.ts)
- Found 1 hardcoded French-only string in CreateCourse.tsx (fixed)
- Added new translation sections to `i18n.ts`: `landing.*` (navHome, navFeatures, poweredBy, heroHeading, featureCards, audienceCards, heroBadges, faqTitle, faqSubtitle, faqs, finalCta, securePayment), `auth.*` (20+ keys for auth page), `payment.*` (4 keys for payment messages)
- Updated `store.ts`: default lang changed from "fr" to "en", added localStorage persistence (`coursia-lang`)
- Updated `layout.tsx`: `<html lang="en">`
- Rewrote `LandingPage.tsx`: removed all inline `isFr` ternaries, replaced with `tx.*` references, added Globe language toggle button in top-right of navbar
- Rewrote `AuthPage.tsx`: removed all inline `isFr` ternaries, replaced with `tx.*` references, added language toggle button in top-right corner
- Updated `AppShell.tsx`: replaced 5 payment message ternaries with `tx.payment.*` references
- Fixed CreateCourse.tsx: replaced hardcoded French error string with `tx.common.error`

Stage Summary:
- English is now the default language for the entire app
- Language toggle button (Globe icon with EN/FR) appears in:
  - Landing page navbar (top-right)
  - Auth page (fixed top-right)
  - App top bar (existing toggle, already present in authenticated views)
- Language preference is persisted to localStorage
- All user-facing text in LandingPage, AuthPage, and AppShell now uses centralized i18n translations
- Remaining 87 inline ternaries in other components (CourseViewer, SettingsPage, etc.) already have correct EN/FR translations — not a user-facing issue
