---
Task ID: 1
Agent: Main
Task: Domain purchase guide + Full SEO implementation

Work Log:
- Guided user step-by-step for purchasing coursia.app via Vercel dashboard
- Answered user's question: yes, all future code changes will automatically reflect on the new domain
- Updated app/layout.tsx with metadataBase (https://coursia.app), title.template, complete Open Graph, Twitter Cards, canonical URL, hreflang
- Created app/sitemap.ts (auto-generated sitemap)
- Created app/robots.ts (allow all except /api/, block GPTBot)
- Deleted public/robots.txt (replaced by app/robots.ts)
- Added JSON-LD Organization + WebSite in layout <head>
- Added JSON-LD FAQPage + SoftwareApplication in LandingPage (client-side <script> tags)
- Converted nav links from <button onClick> to <a href> for SEO crawlability
- Added aria-label on main nav for accessibility
- Added display: "swap" to next/font to prevent FOIT
- Set <html lang="fr"> as default language
- Verified: no <img> tags in code, all images use next/image
- Verified: fonts already use next/font
- Updated STATUS.md with all SEO changes
- Pushed to GitHub (commit 137ae1d)

Stage Summary:
- Complete SEO foundation implemented: metadata, sitemap, robots, JSON-LD (4 schemas), Open Graph, Twitter Cards, hreflang, canonical, semantic HTML, accessibility
- All 10 todo items completed
- Domain guide provided: Vercel Dashboard → Settings → Domains → Purchase coursia.app

---
Task ID: 2
Agent: Main
Task: Fix free course generation redirect bug for new users

Work Log:
- Read paywall-status API route — logic is correct (returns canGenerate:true for new users)
- Read generate API route — atomic transaction correctly checks freeCourseUsed
- Read CreateCourse.tsx — found the bug in fetchCourses()
- Root cause: catch block was empty (silently ignoring errors), so when paywall-status API failed, canCreateCourse stayed at initial value `false` while paywallLoaded became `true` → button enabled but generateCourse() redirected to offers
- Secondary bug: if API returns 200 but canGenerate is undefined, !!undefined = false
- Fixed fetchCourses: fail-open (default canCreateCourse to true) in both catch and non-OK response
- Fixed canGenerate parsing: treat undefined as true
- Fixed register route: added missing freeCourseUsed + hasCardOnFile columns to PostgreSQL migration
- Pushed (commit 9bbd19c)

Stage Summary:
- Bug was a fail-CLOSE design pattern in the client-side paywall check
- Changed to fail-OPEN: if we can't determine status, allow generation (the server-side API does the real atomic check anyway)
- Files modified: CreateCourse.tsx, register/route.ts, STATUS.md

---
Task ID: 3
Agent: Main
Task: Fix free course generation STILL redirecting to offers (production bug)

Work Log:
- User reported: friends testing on coursia.app are redirected to offers page when trying to generate their free course
- Read CreateCourse.tsx — client-side fail-open fix from session 4 was correct
- Read paywall-status API — logic correct, returns canGenerate:true for new users
- Read generate API route — FOUND THE ROOT CAUSE:
  - Line 813-816: catch block was FAIL-CLOSED for ANY DB error
  - If the Prisma transaction failed (column missing, connection error, etc.), it returned FREE_LIMIT (403)
  - Client received FREE_LIMIT → redirected to offers page
  - The generate API did NOT call ensureAllColumns() before the transaction
- Fix 1: Added ensureFreeCourseColumn() migration function to generate/route.ts (mirrors paywall-status)
- Fix 2: Changed catch block from fail-closed to fail-open:
  - Before: ANY DB error → return FREE_LIMIT (403) → redirect to offers
  - After: DB error → log warning, proceed with generation
  - FREE_LIMIT only returned when user genuinely used their free course (freeCourseUsed=true)
- Fix 3: Register route now explicitly sets freeCourseUsed=false and hasCardOnFile=false in INSERT
- Lint passed (no new errors), pushed to GitHub (commit 3b804b4)

Stage Summary:
- The previous session fixed the CLIENT-SIDE fail-close, but missed the SERVER-SIDE fail-close in generate API
- Both sides are now fail-open: if we can't determine quota status, allow generation
- Files modified: generate/route.ts, register/route.ts

---
Task ID: 4
Agent: Main
Task: Payment flow audit (PayPal, offers page, checkout, capture, webhook)

Work Log:
- Read all 8 payment-related files: OffersPage.tsx, PayPalProvider.tsx, paypal.ts, checkout/route.ts, capture/route.ts, webhook/route.ts, verify-card/route.ts, paypal/config/route.ts, AppShell.tsx
- Found 5 bugs:
  1. CRITICAL: paypal.ts line 134 — fallback URL was `coursia-8oi4.vercel.app` instead of `coursia.app`. After PayPal payment, user redirected to WRONG URL
  2. AppShell.tsx line 406 — card verification capture sent `plan: "monthly"` instead of `plan: "card_verify"`
  3. AppShell.tsx line 342-356 — pre-existing parsing error: missing `catch` block and missing closing brace for `if (uid)` in payment redirect handler
  4. register/route.ts — missing PostgreSQL tables (PaymentRequest, Feedback, UsedTopic) in ensureDatabaseReady. Payments would FAIL on PostgreSQL deployment
  5. checkout/route.ts and capture/route.ts — no ensureColumns() for PostgreSQL safety
- All 5 bugs fixed
- Lint passed (also fixed pre-existing AppShell parsing error), pushed (commit 6de9ba0)

Stage Summary:
- Most critical: PayPal redirect URL was pointing to old Vercel preview URL
- Added 3 missing PostgreSQL tables to ensureDatabaseReady
- Added ensureColumns() to checkout and capture APIs
- Fixed pre-existing syntax error in AppShell payment handler
- Files modified: paypal.ts, AppShell.tsx, register/route.ts, checkout/route.ts, capture/route.ts
---
Task ID: 4
Agent: Main
Task: Fix free course generation redirect to offers (3rd fix)

Work Log:
- Identified root cause: client-side paywall pre-check (line 387) was blocking the generate API call before it reached the server
- Two-layer defense was causing false positives: client checked canCreateCourse → redirected to offers, server never got a chance to do the atomic fail-open check
- Previous fixes (sessions 4 and 5) only fixed the server side; the client-side pre-check was still blocking
- Removed the entire client-side paywall pre-check block (lines 382-397)
- The server is now the single source of truth for quota enforcement
- Server-side FREE_LIMIT error handler (line 496) still handles the redirect when genuinely needed
- Pushed as commit 8c661ac

Stage Summary:
- Root cause: Duplicate paywall check where client-side check ran first and blocked the request
- Fix: Remove client-side pre-check, let server (generate API) be the sole decision maker
- File changed: src/components/coursia/CreateCourse.tsx (removed 13 lines, added 3)
- Commit: 8c661ac pushed to main

---
Task ID: 1-b
Agent: general-purpose
Task: Implement daily course generation limit

Work Log:
- Updated generate/route.ts catch block (line 839-846): replaced blind fail-open with fail-safe fallback that counts user courses; if count > 0, blocks as FREE_LIMIT; if count also fails, allows as last-resort fail-open
- Added daily generation limit check in generate/route.ts after free course check block (before Step 0 search): determines limit (4 for active subscribers, 1 for non-subscribers/anonymous), counts today's courses via UTC midnight filter, returns 429 DAILY_LIMIT with reset metadata if exceeded
- Added 5 new fields to PaywallStatus interface: dailyLimit, coursesToday, dailyResetAt, dailyResetInMs, dailyLimitReached
- Added default values in defaultStatus(): dailyLimit: 9999, coursesToday: 0, dailyLimitReached: false
- Created getDailyLimitInfo() helper in paywall-status/route.ts that queries course count and computes reset timestamp
- Integrated daily limit info into all 6 response branches: no-user, active subscriber (canGenerate toggled by dailyLimitReached), grace period, grace expired, free user (used), free user (new)
- Fixed TS2322 by adding `as PaywallStatus` assertion on defaultStatus return (spreading Partial over required fields)

Stage Summary:
- Daily limits enforced server-side: 4/day for active subscribers, 1/day for free/anonymous users
- Free course atomic transaction logic untouched; only catch block hardened with course-count fallback
- Paywall status API now exposes daily limit info so frontend can show countdown/reset timers
- No frontend files modified, no other API routes touched
- All TS errors in modified files are pre-existing (outline possibly null at lines 964+)
- Files modified: src/app/api/courses/generate/route.ts, src/app/api/courses/paywall-status/route.ts

---
Task ID: 1-a
Agent: general-purpose
Task: Fix language mismatch in AI course generation prompts

Work Log:
- Created `getPromptStrings(lang)` helper function (~180 lines) returning all language-dependent prompt text organized into `outline`, `chapter`, `emergency`, and `singleCall` sections
- Rewrote `buildOutlineSystemPrompt()` to use helper — all instruction text, level descriptions, mission block, JSON format example now bilingual
- Rewrote `buildChapterSystemPrompt()` to use helper — all 7 ## headings (understanding, whyCrucial, fundamentals, caseStudy, misconceptions, reflect, action), all section instructions, techniques list, style rules, prohibited items, JSON response template now bilingual
- Updated `generateChapter()` user prompt: "Rédige le chapitre..." → bilingual via helper
- Updated `generateChapterEmergency()`: system prompt and user prompt now fully bilingual (was English-only before, now properly supports both languages)
- Updated `generateSingleCall()`: system role, rules, chapter rules, structure description, research block header, JSON format example, and user prompt all now bilingual
- Fixed remaining hardcoded labels: "Niveau :" → `s.chapter.levelLabel`, "Langue :" → `s.chapter.languageLabel`

Stage Summary:
- All 5 prompt-generation functions now fully respect `courseLang` parameter ("fr" or "en")
- Zero new TypeScript errors introduced (14 pre-existing `outline possibly null` errors unchanged)
- JSON response format (`{title, content, summary}`) preserved exactly — only the ## headings inside `content` and instruction text language changed
- No logic changes — only prompt text strings were modified
- File modified: src/app/api/courses/generate/route.ts (+224 lines for helper, net +225/-204)
---
Task ID: 5
Agent: Main
Task: Fix language mismatch + free course enforcement + daily limit (4/day)

Work Log:
- Identified 3 issues: (1) language mismatch in AI prompts, (2) free course not enforced, (3) no daily limit
- Dispatched sub-agents 1-a (language) and 1-b (daily limit + free course fix) in parallel
- Sub-agent 1-a: Created getPromptStrings(lang) helper, updated all 5 prompt functions (outline, chapter, emergency, single-call, generateChapter) with full bilingual support
- Sub-agent 1-b: Added daily limit check (4/day subscribers, 1/day free), improved fail-open catch to use course count fallback, added getDailyLimitInfo to paywall-status
- Main agent: Updated CreateCourse.tsx — added DAILY_LIMIT error handling, countdown timer, daily counter, updated UI messages, disabled generate button on limit
- All lint checks passed, dev server compiles clean
- Pushed as commit 90e850d

Stage Summary:
- Language: All AI prompts now fully bilingual (fr/en) via getPromptStrings() helper
- Free course: Fallback check counts existing courses if atomic transaction fails
- Daily limit: 4/day subscribers, 1/day free, HTTP 429 with reset metadata
- UI: Countdown timer, daily counter (X/4), "Tu as utilisé ton cours gratuit" message
- Files changed: generate/route.ts, paywall-status/route.ts, CreateCourse.tsx
- Commit: 90e850d pushed to main
