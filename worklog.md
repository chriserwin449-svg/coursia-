---
Task ID: 1
Agent: Main Agent
Task: Integrate PayPal Business payment system into Coursia (sandbox mode)

Work Log:
- Installed @paypal/react-paypal-js v10.0.0
- Created .env with PayPal sandbox config variables (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_MODE, NEXT_PUBLIC_PAYPAL_CLIENT_ID)
- Created src/lib/paypal.ts — full PayPal backend helper with:
  - Access token management with caching
  - createPayPalOrder() — creates checkout orders via PayPal REST API v2
  - capturePayPalOrder() — captures approved payments
  - verifyWebhookSignature() — verifies webhook signatures
  - Configuration helpers (getClientId, getPayPalMode)
- Rewrote src/app/api/subscription/checkout/route.ts — now creates PayPal orders instead of Chariow links
- Created src/app/api/subscription/capture/route.ts — new route to capture PayPal payments server-side after approval
- Rewrote src/app/api/subscription/webhook/route.ts — full PayPal webhook handler:
  - Verifies webhook signatures
  - Handles PAYMENT.CAPTURE.COMPLETED to auto-activate subscriptions
  - Fallback lookup by PayPal order ID
- Created src/components/coursia/PayPalProvider.tsx — React PayPalScriptProvider wrapper
- Rewrote src/components/coursia/OffersPage.tsx — replaced Chariow redirect flow with PayPal Checkout buttons:
  - PayPalButtons component from @paypal/react-paypal-js
  - createOrder calls backend API
  - onApprove calls capture endpoint
  - Error/cancel handling
  - Processing/success states
  - Graceful fallback when PayPal not configured
- Updated src/components/coursia/AppShell.tsx — wrapped OffersPage with PayPalProviderWrapper

Stage Summary:
- PayPal integration is complete in sandbox mode
- User needs to: get sandbox credentials from PayPal Developer Dashboard and fill .env
- Files changed: .env, src/lib/paypal.ts, checkout/route.ts, capture/route.ts, webhook/route.ts, PayPalProvider.tsx, OffersPage.tsx, AppShell.tsx
- Lint passes for all src/ files (0 errors)
- Chariow/Fondeka references still exist in confirm/approve/reject admin routes (to be cleaned later)

---
Task ID: 2
Agent: Main Agent
Task: Fix PayPal "not configured" error on Vercel — frontend couldn't access PAYPAL_CLIENT_ID

Work Log:
- Diagnosed root cause: frontend checked `NEXT_PUBLIC_PAYPAL_CLIENT_ID` which was never set on Vercel. In Next.js, only `NEXT_PUBLIC_` prefixed env vars reach the browser.
- Created `src/app/api/paypal/config/route.ts` — new GET endpoint that returns `{ configured, clientId, mode }` from server-side `PAYPAL_CLIENT_ID` (no NEXT_PUBLIC_ needed).
- Rewrote `src/components/coursia/PayPalProvider.tsx` — now fetches PayPal config from `/api/paypal/config` API instead of reading `NEXT_PUBLIC_PAYPAL_CLIENT_ID`.
- Updated `src/components/coursia/OffersPage.tsx` — replaced static env check with API-based config check via useEffect fetch.
- The "Bientôt disponible" / "Coming soon" disabled button will now be replaced with real PayPal buttons because `isPaypalConfigured` will be true when `PAYPAL_CLIENT_ID` exists on Vercel.

Stage Summary:
- PayPal buttons will now render correctly on Vercel because the config is fetched from a server API endpoint.
- No new `NEXT_PUBLIC_` env vars needed on Vercel — the existing `PAYPAL_CLIENT_ID` is sufficient.
- Files changed: src/app/api/paypal/config/route.ts (new), PayPalProvider.tsx (rewritten), OffersPage.tsx (updated)
- User must redeploy on Vercel for changes to take effect.

---
Task ID: 3
Agent: Main Agent
Task: Replace PayPal SDK buttons with custom CTA buttons + redirect flow

Work Log:
- User reported seeing big PayPal circles/logos in the payment cards instead of clean buttons
- User requested replacing them with simple text buttons "Choisir Mensuel" and "Choisir Annuel"
- Updated `/api/subscription/checkout` to return `approveUrl` (PayPal approval redirect URL)
- Rewrote payment flow in OffersPage.tsx:
  - Removed `PayPalButtons` from @paypal/react-paypal-js completely
  - Removed `handleApprove` and `createOrder` callback functions
  - Added `handleCheckout` function that calls checkout API → redirects to `approveUrl`
  - Replaced PayPalButtons with custom styled gradient buttons ("Choisir Mensuel" / "Choose Monthly" and "Choisir Annuel" / "Choose Annual")
  - Monthly button: purple gradient matching card theme
  - Annual button: gold gradient with shimmer animation matching card theme
- Removed `paypalButtonStyle` constant and PayPal CSS wrapper styles
- Removed `PayPalProviderWrapper` from AppShell.tsx — no longer needed
- Payment flow now: Click button → backend creates order → redirect to PayPal → user pays → webhook activates subscription → redirect back
- Lint passes: 0 errors in src/

Stage Summary:
- Clean CTA buttons now replace PayPal SDK rendered buttons
- Payment flow uses redirect-to-PayPal instead of in-page popup
- Files changed: checkout/route.ts, OffersPage.tsx, AppShell.tsx
- PayPalProvider.tsx still exists but is no longer imported
- Webhook at `/api/subscription/webhook` handles payment capture after PayPal redirect
- User needs to redeploy on Vercel
---
Task ID: 1
Agent: main
Task: Update trial duration from 3 to 7 days + implement card verification gating + verify password strength meter

Work Log:
- Updated `src/lib/i18n.ts`: Changed "3 jours d'essai" → "7 jours d'essai" and "3 cours pendant 3 jours" → "3 cours pendant 7 jours" in both FR and EN
- Updated `src/components/coursia/LandingPage.tsx`: Changed FAQ text "3 cours gratuitement pendant 3 jours" → "7 jours" in both languages
- Fixed `src/hooks/useSubscriptionStatus.ts`: Replaced hardcoded `3` with imported `TRIAL_DURATION_DAYS` (7) for trial expiration calculation
- Updated `src/lib/paypal.ts`: Added "card_verify" plan ($0.01) to PLAN_CONFIG, updated CreateOrderParams type, added conditional return_url for card verification
- Created `src/app/api/subscription/verify-card/route.ts`: New API endpoint that creates PayPal $0.01 verification order with rate limiting
- Updated `src/app/api/subscription/capture/route.ts`: Added card_verify handling - sets hasCardOnFile=true without activating subscription; also sets hasCardOnFile for regular subscriptions
- Updated `src/app/api/subscription/webhook/route.ts`: Same card_verify handling for webhook path
- Updated `src/components/coursia/CreateCourse.tsx`: Card modal now calls /api/subscription/verify-card API → redirects to PayPal instead of just going to offers page
- Updated `src/components/coursia/AppShell.tsx`: Added handler for ?card_verified=success query param → shows success celebration → redirects to create page

Stage Summary:
- Trial duration is now consistently 7 days across all text, frontend hook, and backend constants
- Password strength meter already existed and works correctly (Faible → Moyen → Bon → Fort → Excellent)
- Card verification flow: 1st course free → 2nd course requires $0.01 PayPal card verification → 3rd course available → after 3 courses, must subscribe
- Backend: hasCardOnFile flag is properly set via capture/webhook for both card_verify and regular subscription plans
- All changes pass lint and browser verification
---
Task ID: 2
Agent: main
Task: Landing page marketing rewrite + remove Découverte + new free preview flow + chapter blocking

Work Log:
- **Landing Page Rewrite**: Updated hero from "L'IA qui transforme n'importe quel sujet" to "Deviens expert en n'importe quoi. En un clic." with benefit-driven subtitle emphasizing speed, personalization, and progression
- **Features Section**: Rewrote all 3 features to sell benefits: "Des cours sur mesure en secondes", "Progresse de niveau en niveau", "Retiens grâce aux quiz & badges"
- **Pricing Section**: Removed Découverte (Free) card entirely, now only 2 plans (Mensuel $9.99/mois, Annuel $42.99/an with "Économise 64%" badge). Grid changed from 3-col to 2-col centered
- **i18n**: Updated all FR + EN text. Removed free.pricing.free object. Updated FAQ about free courses. Updated tagline
- **Constants**: Replaced TRIAL_MAX_COURSES/TRIAL_DURATION_DAYS/TRIAL_CARD_REQUIRED_AFTER with FREE_COURSE_LIMIT=1 and FREE_CHAPTER_LIMIT=1
- **Generate API**: Simplified to check only FREE_COURSE_LIMIT (1 free course max). Removed trial date logic, card requirement logic, trial expiration
- **Paywall Status API**: New field `freeChapterLimit`. Simplified trial check to free preview check: no courses = canGenerate, 1+ courses = blocked. Added freeChapterLimit to all response objects
- **CourseViewer**: Added subscription state (isSubscribed, freeChapterLimit). Fetches paywall-status alongside course data. `isChapterUnlocked()` now locks chapters beyond freeChapterLimit for non-subscribers. `goToNext()` redirects to offers when non-subscriber tries chapter 2+
- **CreateCourse**: Handles FREE_LIMIT error code from new generate API
- **useSubscriptionStatus**: Updated to use data from API instead of calculating locally. Removed dependency on TRIAL_DURATION_DAYS
- All changes pass lint and browser verification

Stage Summary:
- Landing page now sells benefits and promises, not just features
- Only 2 paid plans visible (no free card)
- New flow: 1st course free, only chapter 1 readable, chapter 2+ blocked → offers page
- Backend enforces 1 free course max, no trial period, no card verification requirement
- CourseViewer visually locks and blocks chapters beyond chapter 1 for non-subscribers
