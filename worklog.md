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
