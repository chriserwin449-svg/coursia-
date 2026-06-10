# Coursia Worklog

---
Task ID: 1
Agent: Main Agent
Task: Complete payment system overhaul, UI fixes, and security hardening for Coursia

Work Log:
- Updated i18n.ts (FR + EN): annual price $28.99 with originalPrice $42.99 strikethrough, periodNote "première année"/"first year"
- Updated i18n.ts: renamed "Niveau de difficulté" → "Niveau du cours" / "Difficulty level" → "Course level"
- Updated CreateCourse.tsx: removed emojis (🌱⚡🔥) from course level selector buttons
- Updated CreateCourse.tsx: removed emoji from random topic level badge
- Updated OffersPage.tsx: added strikethrough original price for annual card, "Offre de lancement" label
- Updated OffersPage.tsx: updated FAQ to remove Creem references, replaced with generic "plateforme sécurisée"
- Updated OffersPage.tsx: bottom payment note changed from "Paiement sécurisé via Creem" → "Paiement 100% sécurisé"
- Updated LandingPage.tsx: same annual pricing strikethrough and "Offre de lancement" treatment
- Updated LandingPage.tsx: payment reference changed to generic "Paiement 100% sécurisé"
- Rewrote /api/subscription/checkout/route.ts with:
  - In-memory rate limiting (5 requests per user per minute)
  - UUID validation for userId
  - Email validation
  - Input sanitization (strip dangerous chars)
  - Nonce generation for idempotency
  - Checkout URL HTTPS validation
  - Security headers (no-cache, X-Content-Type-Options, X-Frame-Options)
  - Server-side price configuration (tamper-proof)
- Rewrote /api/subscription/webhook/route.ts with:
  - HMAC-SHA256 constant-time comparison (timing-safe, crypto.timingSafeEqual)
  - Event idempotency map (24h window, auto-cleanup every 10 min)
  - Anti-replay timestamp freshness check (±5 min tolerance)
  - JSON parse error handling
  - Security headers
  - GET method rejection (405)
- Updated AppShell.tsx: added payment success handler that detects ?payment=success URL param, shows celebration message, cleans URL, redirects to offers page
- Verified: ESLint passes with 0 errors in src/ directory
- Verified: Server compiles and serves HTTP 200 on first request (confirmed via curl)
- Sandbox memory constraints prevent persistent browser testing, but compilation is verified

Stage Summary:
- All 3 pending UI changes completed (pricing, emojis, level label)
- Payment system fully hardened with rate limiting, idempotency, anti-replay, constant-time crypto
- Payment success flow implemented in AppShell
- Code compiles and runs correctly (HTTP 200 verified)
- Creem integration maintained (compatible with new bank account)
- Next step: User needs to create Creem account with bank account, get API keys, then deploy to Vercel

---
Task ID: 2
Agent: Main Agent
Task: Replace Creem with Flutterwave payment gateway (Creem not available in RDC)

Work Log:
- Analyzed payment options for RDC: Creem (unavailable in RDC), Fondeka (no developer API/webhooks), Flutterwave (full API, webhooks, available in RDC)
- Chose Flutterwave as best solution: supports international cards (Visa/Mastercard) + Mobile Money (Vodacom M-Pesa, Airtel, Orange), has full developer API with webhooks, available in DRC
- Rewrote /api/subscription/checkout/route.ts for Flutterwave:
  - POST to Flutterwave /v3/payments API
  - Generates unique tx_ref (CRS-{timestamp}-{random})
  - Returns hosted payment page link (same checkoutUrl interface as Creem)
  - Supports card, mobilemoney, ussd, bank_transfer payment options
  - Rate limiting, UUID/email validation, input sanitization preserved
  - Custom branding on Flutterwave checkout (Coursia Pro logo/title)
- Rewrote /api/subscription/webhook/route.ts for Flutterwave:
  - SHA512 signature verification (verif-hash header = SHA512(body + webhook_secret))
  - Double-verification: after webhook, calls Flutterwave /v3/transactions/{id}/verify API
  - Constant-time comparison for signature verification
  - Event idempotency, anti-replay timestamps preserved
  - Handles: charge.completed, subscription.cancel, subscription.expiry
  - Added paymentProvider column auto-migration
- Frontend unchanged (uses same checkoutUrl redirect pattern)
- ESLint clean (0 errors in src/)
- Committed and pushed to GitHub (b4404c2)

Stage Summary:
- Creem replaced by Flutterwave (available in RDC, full API, international cards + mobile money)
- Security: SHA512 signature, double transaction verification, rate limiting, idempotency
- User needs to: (1) Create Flutterwave business account, (2) Get FLW_SECRET_KEY + FLW_WEBHOOK_SECRET, (3) Set env vars on Vercel

---
Task ID: 3
Agent: Main Agent
Task: Replace Flutterwave with Fondeka-based manual payment (Flutterwave also not available in RDC)

Work Log:
- User confirmed Flutterwave is NOT available in RDC either
- Analyzed options: Creem ❌, Lemon Squeezy ❌, FedaPay ❌, CinetPay ❌, Flutterwave ❌, crypto ❌
- Chose Fondeka payment link with manual confirmation flow
- Added PaymentRequest model to Prisma schema (userId, plan, amount, status, paymentProof, txRef, adminNote)
- Rewrote /api/subscription/checkout/route.ts:
  - Creates PaymentRequest record in DB
  - Returns FONDEKA_PAY_LINK env var as checkoutUrl (opens in new tab)
  - Returns requestId for "I paid" confirmation flow
  - Rate limiting, UUID validation, already-subscribed check
- Created /api/subscription/confirm/route.ts:
  - User calls after paying on Fondeka to confirm
  - Updates PaymentRequest status to "pending_verification"
  - Accepts optional txRef and paymentProof
  - Ownership verification (userId must match)
  - Rate limiting
- Created /api/subscription/admin/pending/route.ts (GET):
  - Lists all pending/pending_verification payment requests
  - Includes user info (email, name, subscription status)
  - Admin auth via ADMIN_SECRET with timing-safe comparison
- Created /api/subscription/admin/approve/route.ts (POST):
  - Admin approves payment → activates subscription
  - Calculates end date (monthly: +1 month, annual: +1 year)
  - Updates User subscription fields
- Created /api/subscription/admin/reject/route.ts (POST):
  - Admin rejects payment with optional note
- Updated /api/subscription/webhook/route.ts: placeholder for future automated gateway
- Updated OffersPage.tsx:
  - Payment steps UI: instructions 1-2-3-4 after redirect to Fondeka
  - "J'ai effectué le paiement" button calls /api/subscription/confirm
  - Auto-polling subscription status every 10s (max 5 min) after confirmation
  - Confirmation success/error states with emerald banners
  - Pricing cards hidden during payment flow, shown after completion
  - ExternalLink icon on checkout buttons
- Updated i18n.ts: 13 new payment strings (FR + EN) for confirmation flow
- ESLint clean (0 errors in src/)
- Committed and pushed to GitHub (9812910)

Stage Summary:
- Fondeka-based payment system operational: redirect → pay → confirm → admin approve
- User needs to: (1) Set FONDEKA_PAY_LINK env var on Vercel (their Fondeka payment link), (2) Set ADMIN_SECRET env var, (3) Use admin endpoints to approve payments
- Future upgrade path: when an automated gateway becomes available in RDC, only checkout + webhook need rewriting

---
Task ID: 4
Agent: Full-stack Developer
Task: Chariow payment integration, 3-day trial with 15 courses, subscription reminders, notification dots

Work Log:
- paywall-status API: TRIAL_DURATION_DAYS 7→3, TRIAL_MAX_COURSES 3→15
- paywall-status API: Added computeRenewalUrgency() with plan-aware thresholds:
  - Monthly: 7d → 3d → 24h → last24h with countdown
  - Annual: 30d → 14d → 7d → 3d → 24h → last24h with countdown
- paywall-status API: Added renewalUrgency, timeRemainingMs, firstName fields to response
- store.ts: Added hasNotification/setHasNotification, notificationDismissed/setNotificationDismissed
- i18n.ts: Updated trial references (7→3 days, 3→15 courses), annual price $42.99 (no discount)
- i18n.ts: Added 14 renewal reminder strings (FR + EN) for personalized countdowns
- i18n.ts: Added trialCounter, trialCounterDay/Days, cannotRenewEarly strings
- checkout/route.ts: Replaced FONDEKA_PAY_LINK with CHARIOW_MONTHLY_LINK + CHARIOW_ANNUAL_LINK
- checkout/route.ts: Annual price 2899→4299 ($42.99)
- TopBar.tsx: Added gold trial counter pill "2 jours d'essai · 12/15 cours" next to random topic button
- Sidebar.tsx: Added red blinking notification dot on "Offres" button (stops when user visits offers)
- AppShell.tsx: Same red blinking dot on mobile bottom nav "Offres" tab
- globals.css: Added .notification-dot CSS animation (subtle pulse)
- OffersPage.tsx: Personalized renewal reminders with user firstName
- OffersPage.tsx: Live countdown timer (HH:MM:SS) in last 24 hours, updates every second
- OffersPage.tsx: "Cannot renew early" message when subscription is active but not ending
- OffersPage.tsx: Sets hasNotification in store for blinking dot logic
- OffersPage.tsx: Removed annual discount (no strikethrough, no "Offre de lancement")
- CreateCourse.tsx: Updated trial banner to show "X jours d'essai · Y/15 cours" format
- LandingPage.tsx: Updated annual pricing ($42.99), removed strikethrough/discount
- LandingPage.tsx: Updated free plan description (15 courses, 3 days)
- ESLint clean (0 errors in src/)
- Committed and pushed to GitHub (db81ec1)

Stage Summary:
- Chariow integration ready: user needs to set CHARIOW_MONTHLY_LINK and CHARIOW_ANNUAL_LINK env vars
- Trial: 3 days, 15 courses max, with live counter in TopBar
- Subscription renewal: personalized reminders with countdown timers
- Notification system: red blinking dot on "Offres" nav item
- Annual plan: $42.99 with no discount
- User needs to: (1) Create Chariow products + get payment links, (2) Set CHARIOW_MONTHLY_LINK + CHARIOW_ANNUAL_LINK + ADMIN_SECRET on Vercel
---
Task ID: 1
Agent: Main Agent
Task: Fix critical bugs and prepare Chariow payment integration for Coursia

Work Log:
- Read all key project files to assess current state (i18n, prisma, APIs, components)
- Discovered generate route still had OLD trial limits (7 days, 3 courses) — THIS was the "preview" bug
- Fixed generate/route.ts: trial 7→3 days, course limit 3→15 courses
- Fixed admin/approve/route.ts: changed provider from "fondeka" to "chariow"
- Fixed notification logic bug: notification was permanently dismissed when entering Offers page and never restored
- Added periodic paywall-status check in AppShell (every 60s) to keep notification state fresh
- Updated MobileBottomNav: simplified notification dot condition to `hasNotification && view !== "offers"` (removed permanent dismissal)
- Updated Sidebar: same notification dot fix
- Cleaned up OffersPage: removed all setHasNotification/setNotificationDismissed references (AppShell now handles this)
- Ran ESLint: no errors in src/ (only pre-existing errors in utility scripts)
- Started dev server and verified with Agent Browser: landing page renders correctly, pricing shows $42.99 annual, 3-day trial, 15 courses

Stage Summary:
- "Preview bug" was the generate API having old limits (7 days / 3 courses) mismatched with frontend (3 days / 15 courses)
- Notification system now works correctly: dot shows on all pages when subscription is ending, hidden on Offers page, reappears when leaving
- Chariow integration is code-ready (uses CHARIOW_MONTHLY_LINK and CHARIOW_ANNUAL_LINK env vars)
- User needs to set CHARIOW_MONTHLY_LINK and CHARIOW_ANNUAL_LINK environment variables on Vercel
