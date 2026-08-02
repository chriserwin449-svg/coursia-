import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateToken(userId: string): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Ensures the database is fully ready for login.
 * Creates tables if missing, adds columns if missing.
 */
async function ensureDatabaseReady(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  const isPostgres = dbUrl && !dbUrl.startsWith("file:");

  try {
    if (isPostgres) {
      // Create User table if it doesn't exist
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

      // Add missing columns
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
    }
  } catch (err) {
    console.error("[ensureDatabaseReady] Error:", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Test DB connection
    try {
      await db.$queryRaw`SELECT 1 as ok`;
    } catch (dbTestError: unknown) {
      const msg = dbTestError instanceof Error ? dbTestError.message : String(dbTestError);
      console.error("[login] DB connection failed:", msg);
      return NextResponse.json(
        { error: "Database unavailable. Please try again in a moment." },
        { status: 503 },
      );
    }

    // Ensure database schema is ready
    await ensureDatabaseReady();

    // Find user using raw SQL (bypasses Prisma schema validation)
    let userRows: Array<Record<string, unknown>> | null = null;
    try {
      userRows = await db.$queryRawUnsafe(
        `SELECT "id", "email", "password", "firstName", "lastName", "avatar" FROM "User" WHERE "email" = $1 LIMIT 1`,
        emailLower
      ) as Array<Record<string, unknown>>;
    } catch (err) {
      console.error("[login] User lookup failed:", err);
      return NextResponse.json(
        { error: "Connection error" },
        { status: 500 },
      );
    }

    const user = userRows?.[0] || null;

    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // Check password format (bcrypt hash vs legacy SHA-256)
    const userPassword = user.password as string;
    let passwordValid = false;

    if (userPassword.startsWith("$2")) {
      passwordValid = await bcrypt.compare(password, userPassword);
    } else {
      // Legacy SHA-256 hash
      const cryptoModule = await import("crypto");
      const crypto = cryptoModule as typeof import("crypto");
      const legacyHash = crypto.createHash("sha256").update(password).update("coursia-salt-2025").digest("hex");
      passwordValid = legacyHash === userPassword;

      // If valid, upgrade to bcrypt
      if (passwordValid) {
        const newHash = await bcrypt.hash(password, 12);
        try {
          await db.$executeRawUnsafe(`UPDATE "User" SET password = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`, newHash, user.id);
        } catch { /* Non-critical */ }
      }
    }

    if (!passwordValid) {
      return NextResponse.json({ error: "wrong_password" }, { status: 401 });
    }

    // Generate new auth token
    const token = generateToken(user.id as string);

    console.log(`✅ [login] User logged in: ${emailLower}`);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar || null,
      },
      token,
    });
  } catch (error) {
    console.error("[login] Unhandled error:", error);
    return NextResponse.json(
      { error: "Connection error" },
      { status: 500 },
    );
  }
}
