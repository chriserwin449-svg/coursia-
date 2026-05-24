-- ═══════════════════════════════════════════════
-- COURSIA - Enable public access for the app
-- Paste this in Supabase SQL Editor and click RUN
-- ═══════════════════════════════════════════════

-- Disable RLS on all tables (Coursia handles auth via API tokens)
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSettings" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Course" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Chapter" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Quiz" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ChapterProgress" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseQuiz" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseProgress" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "FlameTransaction" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" DISABLE ROW LEVEL SECURITY;
