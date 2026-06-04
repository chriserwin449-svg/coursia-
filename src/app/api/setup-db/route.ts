import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Complete database setup + migration for Supabase PostgreSQL.
 * Idempotent: safe to run multiple times.
 * Creates all tables if they don't exist + adds missing columns.
 */
const FULL_SETUP_SQL = `
-- ═══════════════════════════════════════════════════
-- COURSIA — Full Database Setup + Migration
-- ═══════════════════════════════════════════════════

-- 1. User table (with subscription fields)
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

-- Migration: Add subscription columns if missing (for existing tables)
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionPlan" TEXT NOT NULL DEFAULT 'free'; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'none'; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "creemSubscriptionId" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "creemCustomerId" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionStartDate" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionEndDate" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "trialStartDate" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;

-- 2. AppSettings
CREATE TABLE IF NOT EXISTS "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "flamePoints" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. FlameTransaction
CREATE TABLE IF NOT EXISTS "FlameTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "courseId" TEXT,
    "chapterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Course (with userId and level)
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

-- 5. Chapter (with level)
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

-- 6. Quiz
CREATE TABLE IF NOT EXISTS "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questions" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    CONSTRAINT "Quiz_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DO $$ BEGIN ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_chapterId_key" UNIQUE ("chapterId"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 7. ChapterProgress
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

-- 8. CourseQuiz
CREATE TABLE IF NOT EXISTS "CourseQuiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questions" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    CONSTRAINT "CourseQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DO $$ BEGIN ALTER TABLE "CourseQuiz" ADD CONSTRAINT "CourseQuiz_courseId_key" UNIQUE ("courseId"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 9. CourseProgress (with maxUnlockedLevel and stoppedAtLevel)
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

-- 10. StudySession
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

-- Indexes
CREATE INDEX IF NOT EXISTS "FlameTransaction_courseId_idx" ON "FlameTransaction"("courseId");
`;

export async function POST() {
  try {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl || dbUrl.startsWith("file:")) {
      return NextResponse.json({
        success: false,
        message: "DATABASE_URL must be a PostgreSQL connection string for this operation.",
      }, { status: 400 });
    }

    // Execute the full setup + migration
    await db.$executeRawUnsafe(FULL_SETUP_SQL);

    return NextResponse.json({
      success: true,
      message: "✅ Database setup + migration completed successfully!",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Setup failed";
    console.error("Setup DB error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const isSupabase = dbUrl && !dbUrl.startsWith("file:");

  return NextResponse.json({
    configured: !!isSupabase,
    type: isSupabase ? "postgresql" : "sqlite",
  });
}
