/**
 * Auto-migration utility for PostgreSQL (Supabase).
 * Ensures all Prisma schema columns exist in the database.
 * Safe to run multiple times — idempotent.
 */

import { db } from "@/lib/db";

let migrationRan = false;

export async function ensureSchemaUpToDate(): Promise<void> {
  if (migrationRan) return;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.startsWith("file:")) {
    migrationRan = true;
    return; // SQLite — no migration needed
  }

  const migrations = `
    -- User table: subscription fields
    DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionPlan" TEXT NOT NULL DEFAULT 'free'; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'none'; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "creemSubscriptionId" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "creemCustomerId" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionStartDate" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "subscriptionEndDate" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "trialStartDate" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;

    -- Chapter table: level column
    DO $$ BEGIN ALTER TABLE "Chapter" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN null; END $$;

    -- CourseProgress table: progression fields
    DO $$ BEGIN ALTER TABLE "CourseProgress" ADD COLUMN "maxUnlockedLevel" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN null; END $$;
    DO $$ BEGIN ALTER TABLE "CourseProgress" ADD COLUMN "stoppedAtLevel" INTEGER NOT NULL DEFAULT -1; EXCEPTION WHEN duplicate_column THEN null; END $$;
  `;

  try {
    await db.$executeRawUnsafe(migrations);
    console.log("✅ Auto-migration completed successfully");
    migrationRan = true;
  } catch (error) {
    console.error("Auto-migration failed:", error);
    // Don't throw — let the actual operation fail with a clear error
    migrationRan = true;
  }
}
