# Coursia — API Routes

## Auth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | No | Register with email + password. Returns userId + token |
| POST | `/api/auth/login` | No | Login. Returns userId + token |
| POST | `/api/auth/signout` | Yes | Clear session |
| POST | `/api/auth/me` | No | Validate token + userId. Returns user + subscription info |
| GET | `/api/auth/session` | Yes | Get session info |
| GET | `/api/auth/[...nextauth]` | No | NextAuth handler |
| POST | `/api/auth/google-link` | Yes | Link Google account |

## Courses

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/courses` | No* | List user courses. `?userId=X` |
| GET | `/api/courses/[id]` | No* | Get course with chapters. `?userId=X` |
| DELETE | `/api/courses/[id]` | No* | Delete a course |
| POST | `/api/courses/generate` | No* | Generate course via AI. **maxDuration=120** |
| POST | `/api/courses/random` | No | Get random topic suggestion |
| GET | `/api/courses/paywall-status` | No* | Get user access rights (canStudy, canGenerate, etc.) |
| POST | `/api/courses/[id]/chapters/[chapterId]/quiz` | No* | Get/generate chapter quiz |
| POST | `/api/courses/[id]/chapters/[chapterId]/complete` | No* | Mark chapter complete, award flames |
| POST | `/api/courses/[id]/final-quiz` | No* | Get/generate final course quiz |
| POST | `/api/courses/[id]/generate-level` | No* | Generate next difficulty level for course |
| POST | `/api/courses/[id]/stop-level` | No* | Stop current level for review |

*Auth via `Authorization: Bearer <userId>` header or `?userId=X` query param

## Subscription

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/subscription` | Yes | Get subscription details |
| GET | `/api/subscription/status` | Yes | Get subscription status |
| POST | `/api/subscription/checkout` | Yes | Create PayPal order. Rate limited: 3/60s |
| POST | `/api/subscription/capture` | Yes | Capture PayPal payment |
| POST | `/api/subscription/confirm` | Yes | Confirm card verification |
| POST | `/api/subscription/webhook` | No | PayPal webhook handler |
| POST | `/api/subscription/verify-card` | Yes | Verify card (admin flow) |
| POST | `/api/subscription/admin/pending` | No | Admin: list pending requests |
| POST | `/api/subscription/admin/approve` | No | Admin: approve payment |
| POST | `/api/subscription/admin/reject` | No | Admin: reject payment |

## Flames

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/flames` | Yes | Get flame balance |
| POST | `/api/flames` | Yes | Add flame transaction |
| GET | `/api/flames/progression` | Yes | Get flame progression |
| POST | `/api/flames/decay` | Yes | Apply flame decay |

## Other

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/study-time` | Yes | Log study session |
| GET | `/api/badges` | Yes | Get user badges |
| POST | `/api/feedback` | No | Submit user feedback (type, subject, message, email?, page?) |
| GET | `/api/paypal/config` | No | Check PayPal configuration (public) |
| GET | `/api/db-status` | No | Database health check |
| GET | `/api/ai-status` | No | AI provider status check |
| POST | `/api/log-error` | No | Client-side error logging |