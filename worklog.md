---
Task ID: 1
Agent: main
Task: Fix study time + flame points bugs (code audit fixes)

Work Log:
- Fixed `startStudySession` in CourseViewer.tsx: Added Authorization header alongside body userId
- Fixed cleanup `endStudySession` in CourseViewer.tsx useEffect: Added Authorization header
- Fixed `/api/study-time` GET handler: Changed to use `getUserIdFromRequest()` instead of manual header parsing
- Fixed `/api/study-time` POST handler: Removed `userId || "main"` fallback — now uses `userId` directly (no global pollution)
- Fixed comment: "+3 flames" → "+5 flames" to match `STUDY_TIME_GOOD_FLAMES` constant
- Fixed `/api/courses/[id]/chapters/[chapterId]/complete`: Added `&& userId` guard — won't award flames if no userId
- Fixed `/api/courses/[id]/complete-level`: Added 401 guard when userId is missing, removed `|| "main"` fallback
- Fixed `/api/courses/[id]/final-quiz` PUT: Wrapped flame awarding in `if (userId)` block, removed `|| "main"` fallback

Stage Summary:
- All flame-awarding routes now require a valid userId — no more global "main" pollution
- Study time tracking now properly passes Authorization header in start, end, and cleanup
- No more silent failures from empty userId

---
Task ID: 2
Agent: main
Task: Add delete button for received shared courses

Work Log:
- Created DELETE `/api/courses/shared/[shareId]/route.ts` — validates recipient ownership, deletes CourseShare record
- Added `deleteShareTarget` and `deletingShare` state to Library.tsx
- Added `X` icon delete button on each shared course card (stops propagation to prevent opening course)
- Added `deleteSharedCourse` async function with Authorization header
- Added confirmation AlertDialog with same style as existing course delete dialog ("Retirer ce cours ?" / "Remove this course?")
- Added toast success/error feedback after deletion

Stage Summary:
- Users can now delete received shared courses from their library
- Confirmation dialog prevents accidental deletion
- API properly validates that only the recipient can remove their own received shares

---
Task ID: 3
Agent: main
Task: Build notification system for shared courses

Work Log:
- Added `Notification` model to Prisma schema (id, userId, type, title, message, data, isRead, createdAt)
- Ran `bun run db:push` to sync database
- Created `/api/notifications/route.ts` with GET (list + unread count), POST (create for self or target), PATCH (mark read/mark all read)
- Updated `/api/courses/[id]/share/route.ts` to create a notification when sharing a course (type: "course_shared")
- Added notification state to Zustand store: `notifications`, `setNotifications`, `unreadNotificationCount`, `setUnreadNotificationCount`
- Created `NotificationBell.tsx` component with:
  - Bell icon with unread count badge
  - Dropdown panel showing notification list
  - "Tout lire" (Read all) button
  - Per-notification "Mark as read" button
  - Click notification to navigate to shared course
  - Auto-polling every 30 seconds
  - Time-ago formatting (FR/EN)
  - Empty state
- Added NotificationBell to TopBar (between random course button and language toggle)

Stage Summary:
- Complete notification system: DB model → API routes → Store → UI component
- Notifications created automatically when a course is shared
- Bell shows unread count badge
- Dropdown shows notification list with mark-as-read functionality
- Works both online and offline (notifications persist in DB)
