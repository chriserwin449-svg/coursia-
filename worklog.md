---
Task ID: 1
Agent: Main
Task: Server crash diagnosis and fix + Full Coursia app audit

Work Log:
- Diagnosed dev server crash: process dies between bash tool invocations (sandbox session cleanup)
- Verified no compilation errors: `bun run lint` passes clean
- Verified no code bugs in CourseViewer.tsx (1225 lines, complete)
- Started server successfully: HTTP 200, 154KB rendered
- Ran full audit of all 17 components (231KB total)
- All 30 i18n keys verified present in FR and EN
- Prisma schema verified: flameAwarded field exists on both ChapterProgress and CourseProgress
- calculateFlameEarned function verified in src/lib/flames.ts
- Library.tsx mauve hover effects confirmed
- Journey.tsx verified: flame bar, stats, badges, study time all present
- API routes verified: /api/courses, /complete, /final-quiz all return 200

Stage Summary:
- App is functionally complete with all requested features
- Quiz only at end of courses ✅
- Suivant button goes to next chapter directly ✅
- Chapter numbers show unlocked chapters ✅
- Text enlarged (1.55rem paragraphs, 2.2rem H2) ✅
- Progress counters and progress bar work from server data ✅
- Mauve hover effects on Library cards ✅
- Dev server running but sandbox kills background processes between commands
- User should test preview immediately after server restart
