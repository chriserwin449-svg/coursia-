---
Task ID: 2-3
Agent: Full-stack developer
Task: LandingPage avatars removal, fixed "Commencer" button, FAQ update + TopBar random button visibility

Work Log:
- **LandingPage.tsx** — Removed `avatar` field from all 6 testimonials in the data array
- **LandingPage.tsx** — Replaced `<img>` avatar in `TestimonialCard` with a mauve/purple gradient circle (`bg-gradient-to-br from-mauve to-mauve-dark`) showing the first letter of the author's name in white bold text
- **LandingPage.tsx** — Added fixed-position "Commencer"/"Start" button at top-right (z-50, `bg-black text-white rounded-full px-6 py-2.5`) that navigates to auth or create based on login state
- **LandingPage.tsx** — Replaced 6 generic FAQ items with 5 subscription-focused questions: paid plan benefits, free trial, refund guarantee, offline access (coming soon), annual plan advantages (64% savings)
- **TopBar.tsx** — Added `view` from `useAppStore` and conditionally renders the random topic button (Shuffle + lang selectors) only when `view === "create"`
- **TopBar.tsx** — Language toggle (Globe button) remains visible on all pages as before
- **AppShell.tsx** — No changes needed; confirmed existing `{view !== "viewer" && <TopBar />}` logic is correct
- Lint passes for all modified files (6 pre-existing errors in mini-services JS files are unrelated)

Stage Summary:
- Testimonial avatars removed for faster loading, replaced with styled initial circles
- Fixed "Commencer" CTA button added to landing page top-right corner
- FAQ updated to 5 questions designed to drive paid subscriptions
- Random topic button now only appears on the Create page
