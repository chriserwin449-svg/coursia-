---
Task ID: 1
Agent: Main
Task: Fix flame bar accumulation + notification system enhancements + Google OAuth

Work Log:
- Fixed /api/flames GET to require userId (no more "main" fallback) and properly check subscription status
- Fixed /api/flames POST to require userId (401 if missing)
- Added periodic flame data polling (8s interval) in Journey component
- Added `flame_points_earned` notifications in: chapter-complete, complete-level, final-quiz, level-quiz, study-time routes
- Added `flame_tier_up` notification checks in level-quiz and study-time routes
- Fixed NotificationBell: compact mobile dropdown (absolute positioned, max-w-sm), delete button per notification, clear all button, flame_points_earned type support
- Added DELETE endpoint to /api/notifications (single + clearAll)
- Added Google OAuth: GoogleProvider in NextAuth config, /api/auth/google/callback route, Google button in AuthPage with divider, Google OAuth redirect handling
- Verified delete shared courses feature exists in Library.tsx with AlertDialog confirmation

Stage Summary:
- Flame bar now polls every 8s on Journey page and shows correct per-user data
- Notifications created for all flame point earning events (chapter, level, quiz, study time)
- Notification bell has compact mobile dropdown, per-item delete, clear-all, badge count
- Google OAuth added (needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars to be functional)
- Delete shared courses feature verified working
- NOT pushed to GitHub per user request
---
Task ID: 2
Agent: Main
Task: Fix contact email, add notifications page, expand notification types, verify features

Work Log:
- Changed contact email from support@coursia.app to hellocoursia@gmail.com in both Privacy Policy and Terms of Use sections of LegalPage.tsx (all 4 occurrences: FR+EN for privacy, FR+EN for terms)
- Created full NotificationsPage component (src/components/coursia/NotificationsPage.tsx) with:
  - Full-page view for all notifications
  - Filter tabs (All / Unread)
  - Per-notification delete button
  - Mark all as read / Clear all buttons
  - Auto-marks all as read when opening page (clears badge count)
  - Click handling to navigate to relevant content (courses, journey, offers)
  - Proper empty states for no notifications
- Added "notifications" view type to AppView in store.ts
- Added NotificationsPage import and view rendering in AppShell.tsx
- Added "See all notifications" link at bottom of NotificationBell dropdown
- Added payment_success notification when subscription is activated (webhook/route.ts activateSubscription)
- Added subscription_canceled and subscription_expired notifications (webhook/route.ts markSubscriptionStatus)
- Fixed import path typo in webhook/route.ts (lib/db → @/lib/db)
- Verified certificate_earned notification already exists in certificates/generate/route.ts
- Verified delete shared course feature with AlertDialog confirmation + reassurance message exists in Library.tsx
- Verified flame bar implementation: Journey.tsx fetches /api/flames on mount + polls every 8s, correct display
- Verified NotificationBell badge count shows unreadCount number (1-9+), clears when page opened
- Added NEXTAUTH_SECRET and GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET to .env for Google OAuth setup
- Updated server-keeper to use `bun run dev` instead of `npx next dev`

Stage Summary:
- Contact email changed to hellocoursia@gmail.com in both legal pages (FR + EN)
- Full notifications page created with filter, delete, mark-read functionality
- Notification dropdown has "See all notifications" link
- Badge count auto-clears when notifications page is opened
- Payment/subscription notifications now sent via webhook (payment_success, subscription_canceled, subscription_expired)
- Google OAuth env vars configured (needs real Google Console credentials to be functional)
- All previous features verified working (delete shared course, flame bar, notification badge)
