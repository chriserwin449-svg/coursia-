/**
 * Auto-migration utility for PostgreSQL (Supabase).
 * Ensures all Prisma schema tables exist and all columns are present.
 * Fully idempotent — safe to run multiple times.
 */

import { db } from "@/lib/db";

let migrationRan = false;

export async function ensureSchemaUpToDate(): Promise<void> {
  if (migrationRan) return;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.startsWith("file:")) {
    migrationRan = true;
    return; // SQLite — Prisma handles it
  }

  try {
    // Create tables if they don't exist
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
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
    `);
    try {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    } catch { /* ignore */ }

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AppSettings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "flamePoints" INTEGER NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.$executeRawUnsafe(`
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
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Chapter" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "summary" TEXT NOT NULL DEFAULT '',
        "order" INTEGER NOT NULL,
        "level" INTEGER NOT NULL DEFAULT 0,
        "courseId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Quiz" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "questions" TEXT NOT NULL,
        "chapterId" TEXT NOT NULL
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ChapterProgress" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "chapterId" TEXT NOT NULL,
        "completed" BOOLEAN NOT NULL DEFAULT false,
        "score" INTEGER NOT NULL DEFAULT 0,
        "completedAt" TIMESTAMP(3),
        "flameAwarded" BOOLEAN NOT NULL DEFAULT false
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CourseQuiz" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "questions" TEXT NOT NULL,
        "courseId" TEXT NOT NULL
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CourseProgress" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "courseId" TEXT NOT NULL,
        "completed" BOOLEAN NOT NULL DEFAULT false,
        "score" INTEGER NOT NULL DEFAULT 0,
        "passedAt" TIMESTAMP(3),
        "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
        "maxUnlockedLevel" INTEGER NOT NULL DEFAULT 0,
        "stoppedAtLevel" INTEGER NOT NULL DEFAULT -1
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "FlameTransaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "amount" INTEGER NOT NULL,
        "reason" TEXT NOT NULL,
        "courseId" TEXT,
        "chapterId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StudySession" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT,
        "chapterId" TEXT,
        "courseId" TEXT NOT NULL,
        "startTime" TIMESTAMP(3) NOT NULL,
        "endTime" TIMESTAMP(3),
        "durationSeconds" INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Add missing columns to existing tables
    const userColumns = [
      ["subscriptionPlan", "TEXT NOT NULL DEFAULT 'free'"],
      ["subscriptionStatus", "TEXT NOT NULL DEFAULT 'none'"],
      ["creemSubscriptionId", "TEXT"],
      ["creemCustomerId", "TEXT"],
      ["subscriptionStartDate", "TIMESTAMP(3)"],
      ["subscriptionEndDate", "TIMESTAMP(3)"],
      ["trialStartDate", "TIMESTAMP(3)"],
    ];
    for (const [col, def] of userColumns) {
      try {
        await db.$executeRawUnsafe(
          `DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "${col}" ${def}; EXCEPTION WHEN duplicate_column THEN null; END $$;`
        );
      } catch { /* ignore */ }
    }

    const cpColumns = [
      ["maxUnlockedLevel", "INTEGER NOT NULL DEFAULT 0"],
      ["stoppedAtLevel", "INTEGER NOT NULL DEFAULT -1"],
    ];
    for (const [col, def] of cpColumns) {
      try {
        await db.$executeRawUnsafe(
          `DO $$ BEGIN ALTER TABLE "CourseProgress" ADD COLUMN "${col}" ${def}; EXCEPTION WHEN duplicate_column THEN null; END $$;`
        );
      } catch { /* ignore */ }
    }

    try {
      await db.$executeRawUnsafe(
        `DO $$ BEGIN ALTER TABLE "Chapter" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN null; END $$;`
      );
    } catch { /* ignore */ }

    try {
      await db.$executeRawUnsafe(
        `DO $$ BEGIN ALTER TABLE "FlameTransaction" ADD COLUMN "userId" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;`
      );
    } catch { /* ignore */ }

    try {
      await db.$executeRawUnsafe(
        `DO $$ BEGIN ALTER TABLE "StudySession" ADD COLUMN "flameAwarded" BOOLEAN NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN null; END $$;`
      );
    } catch { /* ignore */ }

    // ── P2003 fix: Drop the dual-FK constraint that required CourseProgress to exist ──
    // StudySession.courseId now only references Course.id (not CourseProgress)
    try {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "StudySession" DROP CONSTRAINT IF EXISTS "StudySession_progress_fkey";
        EXCEPTION WHEN undefined_object THEN null; END $$
      `);
    } catch { /* ignore */ }

    console.log("✅ Auto-migration completed successfully");
    migrationRan = true;
  } catch (error) {
    console.error("Auto-migration failed:", error);
    migrationRan = true;
  }
}
