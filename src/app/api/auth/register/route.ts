import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateToken(userId: string): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Migrate a single column if it doesn't exist.
 * Runs each ALTER TABLE separately so one failure doesn't block others.
 */
async function migrateColumn(table: string, col: string, colDef: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `DO $$ BEGIN ALTER TABLE "${table}" ADD COLUMN "${col}" ${colDef}; EXCEPTION WHEN duplicate_column THEN null; END $$;`
    );
  } catch (err) {
    console.warn(`[migrate] ${table}.${col} failed:`, err instanceof Error ? err.message : err);
  }
}

async function ensureAllColumns(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.startsWith("file:")) return; // SQLite

  try {
    // User subscription columns
    await migrateColumn("User", "subscriptionPlan", "TEXT NOT NULL DEFAULT 'free'");
    await migrateColumn("User", "subscriptionStatus", "TEXT NOT NULL DEFAULT 'none'");
    await migrateColumn("User", "creemSubscriptionId", "TEXT");
    await migrateColumn("User", "creemCustomerId", "TEXT");
    await migrateColumn("User", "subscriptionStartDate", "TIMESTAMP(3)");
    await migrateColumn("User", "subscriptionEndDate", "TIMESTAMP(3)");
    await migrateColumn("User", "trialStartDate", "TIMESTAMP(3)");
    // Chapter level
    await migrateColumn("Chapter", "level", "INTEGER NOT NULL DEFAULT 0");
    // CourseProgress fields
    await migrateColumn("CourseProgress", "maxUnlockedLevel", "INTEGER NOT NULL DEFAULT 0");
    await migrateColumn("CourseProgress", "stoppedAtLevel", "INTEGER NOT NULL DEFAULT -1");
    console.log("✅ Column migration check completed");
  } catch (err) {
    console.error("[migrate] Column migration failed:", err);
  }
}

/**
 * Try creating a user using only basic columns (no subscription fields).
 * If Prisma model has fields not in DB, we catch and provide detailed error.
 */
async function createUserBasic(email: string, hashedPassword: string, firstName: string, lastName: string) {
  // Attempt 1: Normal Prisma create (works if all columns exist)
  try {
    return await db.user.create({
      data: { email, password: hashedPassword, firstName, lastName },
    });
  } catch (prismaErr) {
    const msg = prismaErr instanceof Error ? prismaErr.message : String(prismaErr);
    console.error("[register] Prisma create failed:", msg);

    // Attempt 2: Raw SQL insert with only basic columns (fallback if subscription columns missing)
    if (msg.includes("does not exist") || msg.includes("column") || msg.includes("relation")) {
      console.log("[register] Trying raw SQL fallback...");
      const id = crypto.randomUUID();
      await db.$executeRawUnsafe(
        `INSERT INTO "User" ("id", "email", "password", "firstName", "lastName", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        id, email, hashedPassword, firstName, lastName
      );
      return await db.user.findUnique({ where: { id } });
    }

    throw prismaErr;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mot de passe trop court (min 6 caractères)" },
        { status: 400 },
      );
    }

    const emailLower = email.toLowerCase().trim();
    const first = firstName.trim();
    const last = lastName.trim();

    // Test DB connection first
    try {
      await db.$queryRaw`SELECT 1 as ok`;
    } catch (dbTestError: unknown) {
      const msg = dbTestError instanceof Error ? dbTestError.message : String(dbTestError);
      console.error("[register] DB connection failed:", msg);
      return NextResponse.json(
        { error: "Base de données indisponible. Réessaie dans quelques instants.", debug: msg },
        { status: 503 },
      );
    }

    // Auto-migrate: add missing columns one by one
    await ensureAllColumns();

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email" },
        { status: 409 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user (with fallback to raw SQL if Prisma fails)
    const user = await createUserBasic(emailLower, hashedPassword, first, last);

    if (!user) {
      return NextResponse.json(
        { error: "Erreur lors de la création du compte", debug: "User creation returned null" },
        { status: 500 },
      );
    }

    // Generate auth token
    const token = generateToken(user.id);

    // Ensure AppSettings entry exists
    try {
      await db.appSettings.upsert({
        where: { id: user.id },
        update: {},
        create: { id: user.id, flamePoints: 0 },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    });
  } catch (error: unknown) {
    console.error("[register] Error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Erreur lors de l'inscription", debug: msg },
      { status: 500 },
    );
  }
}
