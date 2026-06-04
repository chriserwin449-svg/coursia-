-- ═══════════════════════════════════════════════════════════════
--  COURSIA — Supabase PostgreSQL Setup + Migration (SAFE)
--  Idempotent: safe to run multiple times on existing databases.
-- ═══════════════════════════════════════════════════════════════
-- Instructions :
--   1. Crée un projet Supabase sur supabase.com
--   2. Va dans le SQL Editor (onglet SQL)
--   3. Colle ce script et clique sur "Run"
--   4. Va dans Settings → Database → Connection string → URI
--      Copie le connection string (commence par postgresql://...)
--   5. Dans ton projet Vercel, ajoute la variable d'environnement :
--      DATABASE_URL = postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. User table (with subscription fields)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'free',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "creemSubscriptionId" TEXT,
    "creemCustomerId" TEXT,
    "subscriptionStartDate" TIMESTAMP(3),
    "subscriptionEndDate" TIMESTAMP(3),
    "trialStartDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Migration: Add subscription columns if missing
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionPlan" TEXT NOT NULL DEFAULT 'free'; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'none'; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "creemSubscriptionId" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "creemCustomerId" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionStartDate" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionEndDate" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "trialStartDate" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. App Settings (flame points) — singleton
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "flamePoints" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- 3. Flame Transactions (gamification ledger)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FlameTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "courseId" TEXT,
    "chapterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- 4. Courses
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sourceLinks" TEXT NOT NULL DEFAULT '[]',
    "level" INTEGER NOT NULL DEFAULT 0,
    "flameCost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Course_userId_idx" ON "Course"("userId");

-- ─────────────────────────────────────────────────────────────
-- 5. Chapters (with level)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "courseId" TEXT NOT NULL,
    CONSTRAINT "Chapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Chapter_courseId_idx" ON "Chapter"("courseId");
DO $$ BEGIN ALTER TABLE "Chapter" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN null; END $$;

-- ─────────────────────────────────────────────────────────────
-- 6. Chapter Quizzes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questions" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    CONSTRAINT "Quiz_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DO $$ BEGIN ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_chapterId_key" UNIQUE ("chapterId"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─────────────────────────────────────────────────────────────
-- 7. Chapter Progress
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ChapterProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ChapterProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DO $$ BEGIN ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_chapterId_key" UNIQUE ("chapterId"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─────────────────────────────────────────────────────────────
-- 8. Course Final Quiz
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CourseQuiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questions" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    CONSTRAINT "CourseQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DO $$ BEGIN ALTER TABLE "CourseQuiz" ADD CONSTRAINT "CourseQuiz_courseId_key" UNIQUE ("courseId"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─────────────────────────────────────────────────────────────
-- 9. Course Progress (with maxUnlockedLevel and stoppedAtLevel)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CourseProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "passedAt" TIMESTAMP(3),
    "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
    "maxUnlockedLevel" INTEGER NOT NULL DEFAULT 0,
    "stoppedAtLevel" INTEGER NOT NULL DEFAULT -1,
    CONSTRAINT "CourseProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DO $$ BEGIN ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_courseId_key" UNIQUE ("courseId"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "CourseProgress" ADD COLUMN "maxUnlockedLevel" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "CourseProgress" ADD COLUMN "stoppedAtLevel" INTEGER NOT NULL DEFAULT -1; EXCEPTION WHEN duplicate_column THEN null; END $$;

-- ─────────────────────────────────────────────────────────────
-- 10. Study Sessions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StudySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "chapterId" TEXT,
    "courseId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StudySession_course_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudySession_courseId_idx" ON "StudySession"("courseId");
CREATE INDEX IF NOT EXISTS "StudySession_userId_idx" ON "StudySession"("userId");

-- ─────────────────────────────────────────────────────────────
-- Indexes for performance
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "FlameTransaction_courseId_idx" ON "FlameTransaction"("courseId");

-- ─────────────────────────────────────────────────────────────
-- Row Level Security (optional — the service role bypasses RLS)
-- Uncomment below if you want additional security via Supabase Auth.
-- ─────────────────────────────────────────────────────────────
-- ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Service role full access" ON "User" FOR ALL USING (true) WITH CHECK (true);
-- (Repeat for other tables as needed)

-- ✅ Setup complete! All tables and columns are ready.
