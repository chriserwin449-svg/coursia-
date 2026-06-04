import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateToken(userId: string): string {
  return crypto.randomBytes(32).toString("hex");
}

async function migrateColumn(table: string, col: string, colDef: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `DO $$ BEGIN ALTER TABLE "${table}" ADD COLUMN "${col}" ${colDef}; EXCEPTION WHEN duplicate_column THEN null; END $$;`
    );
  } catch {
    // Ignore — non-critical
  }
}

async function ensureAllColumns(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.startsWith("file:")) return;
  try {
    await migrateColumn("User", "subscriptionPlan", "TEXT NOT NULL DEFAULT 'free'");
    await migrateColumn("User", "subscriptionStatus", "TEXT NOT NULL DEFAULT 'none'");
    await migrateColumn("User", "creemSubscriptionId", "TEXT");
    await migrateColumn("User", "creemCustomerId", "TEXT");
    await migrateColumn("User", "subscriptionStartDate", "TIMESTAMP(3)");
    await migrateColumn("User", "subscriptionEndDate", "TIMESTAMP(3)");
    await migrateColumn("User", "trialStartDate", "TIMESTAMP(3)");
    await migrateColumn("Chapter", "level", "INTEGER NOT NULL DEFAULT 0");
    await migrateColumn("CourseProgress", "maxUnlockedLevel", "INTEGER NOT NULL DEFAULT 0");
    await migrateColumn("CourseProgress", "stoppedAtLevel", "INTEGER NOT NULL DEFAULT -1");
  } catch {
    // Non-critical
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 },
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Auto-migrate schema if needed
    await ensureAllColumns();

    // Find user — use raw query to avoid Prisma failing on missing columns
    let user: Record<string, unknown> | null = null;
    try {
      user = await db.user.findUnique({ where: { email: emailLower } }) as unknown as Record<string, unknown> | null;
    } catch {
      // Fallback: raw SQL query with only basic columns
      try {
        const rows = await db.$queryRawUnsafe(
          `SELECT id, email, password, "firstName", "lastName" FROM "User" WHERE email = $1`,
          emailLower
        ) as Array<Record<string, unknown>>;
        user = rows[0] || null;
      } catch (err) {
        console.error("[login] User lookup failed:", err);
        return NextResponse.json({ error: "Erreur lors de la connexion" }, { status: 500 });
      }
    }

    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // Check password format (old hash vs new bcrypt)
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
          await db.$executeRawUnsafe(`UPDATE "User" SET password = $1 WHERE id = $2`, newHash, user.id);
        } catch {
          // Non-critical
        }
      }
    }

    if (!passwordValid) {
      return NextResponse.json({ error: "wrong_password" }, { status: 401 });
    }

    // Generate new auth token
    const token = generateToken(user.id as string);

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
  } catch (error) {
    console.error("[login] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la connexion" },
      { status: 500 },
    );
  }
}
