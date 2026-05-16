-- ═══════════════════════════════════════════════════════════════
--  COURSIA — Supabase PostgreSQL Schema
-- ═══════════════════════════════════════════════════════════════
-- Instructions :
--   1. Crée un projet Supabase sur supabase.com
--   2. Va dans le SQL Editor (onglet SQL)
--   3. Colle ce script et clique sur "Run"
--   4. Copie les infos depuis Settings → API :
--      - Project URL → NEXT_PUBLIC_SUPABASE_URL
--      - Anon public key → NEXT_PUBLIC_SUPABASE_ANON_KEY
--      - Service role key → SUPABASE_SERVICE_ROLE_KEY
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- User table (authentication)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "firstName" TEXT NOT NULL DEFAULT '',
  "lastName" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- App Settings (flame points, subscription) — singleton
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" TEXT PRIMARY KEY DEFAULT 'main',
  "flamePoints" INTEGER NOT NULL DEFAULT 0,
  "hasSubscription" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- Flame Transactions (gamification ledger)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FlameTransaction" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "courseId" TEXT,
  "chapterId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- Courses
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Course" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "sourceLinks" TEXT NOT NULL DEFAULT '[]',
  "level" INTEGER NOT NULL DEFAULT 0,
  "flameCost" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- Chapters
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Chapter" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "Chapter_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- Chapter Quizzes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Quiz" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "questions" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL UNIQUE,
  CONSTRAINT "Quiz_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- Chapter Progress
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ChapterProgress" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "chapterId" TEXT NOT NULL UNIQUE,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "score" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP,
  "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ChapterProgress_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- Course Final Quiz
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CourseQuiz" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "questions" TEXT NOT NULL,
  "courseId" TEXT NOT NULL UNIQUE,
  CONSTRAINT "CourseQuiz_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- Course Progress
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CourseProgress" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "courseId" TEXT NOT NULL UNIQUE,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "score" INTEGER NOT NULL DEFAULT 0,
  "passedAt" TIMESTAMP,
  "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "CourseProgress_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- Study Sessions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StudySession" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  "chapterId" TEXT,
  "courseId" TEXT NOT NULL,
  "startTime" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endTime" TIMESTAMP,
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StudySession_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudySession_progress_fkey"
    FOREIGN KEY ("courseId") REFERENCES "CourseProgress"("courseId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- Indexes for performance
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Course_userId_idx" ON "Course"("userId");
CREATE INDEX IF NOT EXISTS "Chapter_courseId_idx" ON "Chapter"("courseId");
CREATE INDEX IF NOT EXISTS "FlameTransaction_courseId_idx" ON "FlameTransaction"("courseId");
CREATE INDEX IF NOT EXISTS "StudySession_courseId_idx" ON "StudySession"("courseId");
CREATE INDEX IF NOT EXISTS "StudySession_userId_idx" ON "StudySession"("userId");

-- ─────────────────────────────────────────────────────────────
-- Enable Row Level Security (RLS) for security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlameTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Chapter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quiz" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChapterProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseQuiz" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- RLS Policies (service role bypasses all policies)
-- ─────────────────────────────────────────────────────────────
-- For anon/user access — allow reads for courses, chapters, quizzes
CREATE POLICY "Public read courses" ON "Course"
  FOR SELECT USING (true);

CREATE POLICY "Public read chapters" ON "Chapter"
  FOR SELECT USING (true);

CREATE POLICY "Public read quizzes" ON "Quiz"
  FOR SELECT USING (true);

CREATE POLICY "Public read course quizzes" ON "CourseQuiz"
  FOR SELECT USING (true);

CREATE POLICY "Public read app settings" ON "AppSettings"
  FOR SELECT USING (true);

-- Authenticated users can insert/update their own data
CREATE POLICY "Authenticated insert user" ON "User"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated update user" ON "User"
  FOR UPDATE USING (true);

CREATE POLICY "Service role full access" ON "FlameTransaction"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access progress" ON "ChapterProgress"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access course progress" ON "CourseProgress"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access sessions" ON "StudySession"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access settings" ON "AppSettings"
  FOR ALL USING (true) WITH CHECK (true);
