---
Task ID: 1
Agent: Main Agent
Task: Fix supabase import error, natural avatars, red flame bar, points earned/lost, course title gradient, confetti animation, course completion overview

Work Log:
- Fixed build error: generate/route.ts was importing from '@/lib/supabase' which doesn't exist. Rewrote to use Prisma (import { db } from "@/lib/db") matching the rest of the project's data layer.
- Regenerated 6 avatar photos with more natural, candid prompts (no studio lighting, casual settings, everyday environments) for marie, thomas, sarah, lucas, emma, nicolas.
- Changed flame bar color from orange/gold to red: updated border, background gradient, bar fill gradient (#ef4444, #f87171, #fb923c), text colors to text-red-400, icon colors to red-400.
- Added "Gagnés" (earned) and "Perdus" (lost) flame points display below the flame progress bar on Journey page, using totalEarned and totalSpent from /api/flames.
- Fixed course title colors: changed from text-gold to gradient-text (mauve-to-gold gradient matching "Coursia" branding) in CourseViewer header and fullscreen mode.
- Added CSS for .prose h1/h2/h3 and .fullscreen-content h1/h2/h3 to use the gradient-text background-clip style globally.
- Created Confetti.tsx component with 80 animated confetti pieces using CSS animation confetti-fall with random positions, colors, sizes, and delays.
- Added Confetti to both celebration overlays (fullscreen and normal view) in CourseViewer.
- Created course completion flow: after passing the final quiz, confetti + celebration overlay shows for 4 seconds, then transitions to a "Course Completed" overview page showing all chapters with green checkmarks (CheckCircle2), scores, and a "Refaire le Quiz" (redo) button for each chapter.
- On the completed overview, clicking any chapter navigates back to that chapter content (all chapters unlocked like a game).
- When reopening a completed course from the library, it directly shows the completion overview.
- Fixed import typo: "lib/store" → "@/lib/store" in CourseViewer.tsx.

Stage Summary:
- Build error fixed: Prisma used throughout, no more supabase references
- 6 natural avatar photos generated and saved
- Flame bar is now red (#ef4444 base)
- Points earned/lost displayed on Journey page
- Course titles use gradient-text (mauve→gold) consistently
- Confetti animation on all celebrations (chapter + course completion)
- Course completion shows overview with all chapters unlocked, green checks, and redo option
