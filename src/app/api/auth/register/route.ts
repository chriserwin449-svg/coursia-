import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateToken(userId: string): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Ensures the database is fully ready for registration.
 * Creates tables if missing, adds columns if missing.
 * Works for both SQLite and PostgreSQL.
 */
async function ensureDatabaseReady(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  const isPostgres = dbUrl && !dbUrl.startsWith("file:");

  try {
    if (isPostgres) {
      // ─── PostgreSQL: Create tables if they don't exist ───

      // User table
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
      // Add unique constraint on email if missing
      try {
        await db.$executeRawUnsafe(`
          DO $$ BEGIN
            ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");
          EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);
      } catch { /* ignore */ }

      // AppSettings table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AppSettings" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "flamePoints" INTEGER NOT NULL DEFAULT 0,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Course table
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

      // Chapter table
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

      // Quiz table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Quiz" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "questions" TEXT NOT NULL,
          "chapterId" TEXT NOT NULL,
          CONSTRAINT "Quiz_chapterId_key" UNIQUE ("chapterId")
        );
      `);

      // ChapterProgress table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ChapterProgress" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "chapterId" TEXT NOT NULL,
          "completed" BOOLEAN NOT NULL DEFAULT false,
          "score" INTEGER NOT NULL DEFAULT 0,
          "completedAt" TIMESTAMP(3),
          "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
          CONSTRAINT "ChapterProgress_chapterId_key" UNIQUE ("chapterId")
        );
      `);

      // CourseQuiz table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CourseQuiz" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "questions" TEXT NOT NULL,
          "courseId" TEXT NOT NULL,
          CONSTRAINT "CourseQuiz_courseId_key" UNIQUE ("courseId")
        );
      `);

      // CourseProgress table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CourseProgress" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "courseId" TEXT NOT NULL,
          "completed" BOOLEAN NOT NULL DEFAULT false,
          "score" INTEGER NOT NULL DEFAULT 0,
          "passedAt" TIMESTAMP(3),
          "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
          "maxUnlockedLevel" INTEGER NOT NULL DEFAULT 0,
          "stoppedAtLevel" INTEGER NOT NULL DEFAULT -1,
          CONSTRAINT "CourseProgress_courseId_key" UNIQUE ("courseId")
        );
      `);

      // FlameTransaction table
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

      // StudySession table
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

      // ─── Add missing columns to existing tables ───
      const userColumns = [
        ["subscriptionPlan", "TEXT NOT NULL DEFAULT 'free'"],
        ["subscriptionStatus", "TEXT NOT NULL DEFAULT 'none'"],
        ["creemSubscriptionId", "TEXT"],
        ["creemCustomerId", "TEXT"],
        ["subscriptionStartDate", "TIMESTAMP(3)"],
        ["subscriptionEndDate", "TIMESTAMP(3)"],
        ["trialStartDate", "TIMESTAMP(3)"],
        ["hasCardOnFile", "BOOLEAN NOT NULL DEFAULT false"],
        ["freeCourseUsed", "BOOLEAN NOT NULL DEFAULT false"],
      ];
      for (const [col, def] of userColumns) {
        try {
          await db.$executeRawUnsafe(
            `DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "${col}" ${def}; EXCEPTION WHEN duplicate_column THEN null; END $$;`
          );
        } catch { /* ignore */ }
      }

      // Chapter.level column
      try {
        await db.$executeRawUnsafe(
          `DO $$ BEGIN ALTER TABLE "Chapter" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN null; END $$;`
        );
      } catch { /* ignore */ }

      // CourseProgress columns
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

      // PaymentRequest table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PaymentRequest" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "plan" TEXT NOT NULL,
          "amount" INTEGER NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'USD',
          "status" TEXT NOT NULL DEFAULT 'pending',
          "paymentProof" TEXT,
          "txRef" TEXT,
          "adminNote" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Feedback table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Feedback" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT,
          "type" TEXT NOT NULL DEFAULT 'general',
          "subject" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "email" TEXT,
          "page" TEXT,
          "metadata" TEXT NOT NULL DEFAULT '{}',
          "status" TEXT NOT NULL DEFAULT 'new',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // UsedTopic table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "UsedTopic" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "title" TEXT NOT NULL,
          "userId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "UsedTopic_title_key" UNIQUE ("title")
        );
      `);

      // InvitationLink table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InvitationLink" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "code" TEXT NOT NULL,
          "courseId" TEXT NOT NULL,
          "createdBy" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "maxUses" INTEGER NOT NULL DEFAULT 100,
          "useCount" INTEGER NOT NULL DEFAULT 0,
          CONSTRAINT "InvitationLink_code_key" UNIQUE ("code")
        );
      `);

      // CourseShare table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CourseShare" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "courseId" TEXT NOT NULL,
          "sharedBy" TEXT NOT NULL,
          "sharedWith" TEXT NOT NULL,
          "message" TEXT,
          "isRead" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Username column on User
      try {
        await db.$executeRawUnsafe(
          `DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "username" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;`
        );
      } catch { /* ignore */ }
      try {
        await db.$executeRawUnsafe(
          `DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_username_key" UNIQUE ("username"); EXCEPTION WHEN duplicate_object THEN null; END $$;`
        );
      } catch { /* ignore */ }

      console.log("✅ PostgreSQL database ensured ready");
    }
    // SQLite: Prisma handles it via schema.prisma — no action needed
  } catch (err) {
    console.error("[ensureDatabaseReady] Error:", err);
    // Don't throw — let the actual operation fail with a clear error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password too short (min 4 characters)" },
        { status: 400 },
      );
    }

    const emailLower = email.toLowerCase().trim();
    const first = firstName.trim();
    const last = lastName.trim();

    // Step 1: Test DB connection
    try {
      await db.$queryRaw`SELECT 1 as ok`;
    } catch (dbTestError: unknown) {
      const msg = dbTestError instanceof Error ? dbTestError.message : String(dbTestError);
      console.error("[register] DB connection failed:", msg);
      return NextResponse.json(
        { error: "Database unavailable. Please try again in a moment." },
        { status: 503 },
      );
    }

    // Step 2: Ensure database schema is ready (creates tables + adds columns)
    await ensureDatabaseReady();

    // Step 3: Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Step 4: Check if user already exists (raw SQL for reliability)
    const dbUrl = process.env.DATABASE_URL;
    const isPostgres = dbUrl && !dbUrl.startsWith("file:");

    let existingUser: Array<{ id: string }> | null = null;
    try {
      existingUser = await db.$queryRawUnsafe(
        `SELECT "id" FROM "User" WHERE "email" = $1 LIMIT 1`,
        emailLower
      ) as Array<{ id: string }>;
    } catch (err) {
      console.error("[register] User lookup error:", err);
      return NextResponse.json(
        { error: "Error verifying email" },
        { status: 500 },
      );
    }

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json(
        { error: "An account already exists with this email" },
        { status: 409 },
      );
    }

    // Step 5: Create user using raw SQL (bypasses Prisma schema validation)
    const userId = crypto.randomUUID();
    try {
      if (isPostgres) {
        await db.$executeRawUnsafe(
          `INSERT INTO "User" ("id", "email", "password", "firstName", "lastName", "subscriptionPlan", "subscriptionStatus", "freeCourseUsed", "hasCardOnFile", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'free', 'none', false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          userId, emailLower, hashedPassword, first, last
        );
      } else {
        // SQLite
        await db.$executeRawUnsafe(
          `INSERT INTO "User" ("id", "email", "password", "firstName", "lastName", "subscriptionPlan", "subscriptionStatus", "freeCourseUsed", "hasCardOnFile", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'free', 'none', false, false, datetime('now'), datetime('now'))`,
          userId, emailLower, hashedPassword, first, last
        );
      }
    } catch (err) {
      console.error("[register] User INSERT error:", err);
      return NextResponse.json(
        { error: "Error creating account" },
        { status: 500 },
      );
    }

    // Step 6: Generate auth token
    const token = generateToken(userId);

    // Step 7: Ensure AppSettings entry (non-blocking)
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "AppSettings" ("id", "flamePoints", "updatedAt")
         VALUES ($1, 0, CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO NOTHING`,
        userId
      );
    } catch {
      // Non-blocking — AppSettings is not critical for registration
    }

    console.log(`✅ [register] User created: ${emailLower} (${userId})`);

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: emailLower,
        firstName: first,
        lastName: last,
      },
      token,
    });
  } catch (error: unknown) {
    console.error("[register] Unhandled error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Registration error" },
      { status: 500 },
    );
  }
}
