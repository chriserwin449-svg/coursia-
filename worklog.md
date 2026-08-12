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
