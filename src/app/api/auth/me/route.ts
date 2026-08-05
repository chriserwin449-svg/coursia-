import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

async function migrateColumn(table: string, col: string, colDef: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `DO $$ BEGIN ALTER TABLE "${table}" ADD COLUMN "${col}" ${colDef}; EXCEPTION WHEN duplicate_column THEN null; END $$;`
    );
  } catch {
    // Non-critical
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
    await migrateColumn("User", "username", "TEXT");
    await migrateColumn("User", "avatar", "TEXT");
    await migrateColumn("User", "freeCourseUsed", "BOOLEAN NOT NULL DEFAULT false");
  } catch {
    // Non-critical
  }
}

function buildSafeUser(user: Record<string, unknown>) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar || null,
  };
}

function buildSubscriptionInfo(user: Record<string, unknown>) {
  const status = user.subscriptionStatus as string || "none";
  return {
    hasSubscription: status === "active",
    subscriptionPlan: (user.subscriptionPlan as string) || "free",
    subscriptionStatus: status,
  };
}

/**
 * POST: verify token + userId from body
 */
export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();

    if (!token || !userId) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    await ensureAllColumns();

    // Try Prisma first, fall back to raw SQL
    let user: Record<string, unknown> | null = null;
    try {
      user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, firstName: true, lastName: true, avatar: true,
          subscriptionPlan: true, subscriptionStatus: true,
          subscriptionStartDate: true, subscriptionEndDate: true, trialStartDate: true,
        },
      }) as unknown as Record<string, unknown>;
    } catch {
      try {
        const rows = await db.$queryRawUnsafe(
          `SELECT id, email, "firstName", "lastName", "avatar", "subscriptionPlan", "subscriptionStatus", "subscriptionStartDate", "subscriptionEndDate", "trialStartDate" FROM "User" WHERE id = $1`,
          userId
        ) as Array<Record<string, unknown>>;
        user = rows[0] || null;
      } catch (err) {
        console.error("[auth/me] Fallback query failed:", err);
      }
    }

    if (!user) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      ...buildSubscriptionInfo(user),
      user: buildSafeUser(user),
    });
  } catch (error) {
    console.error("[auth/me] Error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

/**
 * GET: verify via Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const userId = authHeader.substring(7);

    await ensureAllColumns();

    let user: Record<string, unknown> | null = null;
    try {
      user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, firstName: true, lastName: true, avatar: true,
          subscriptionPlan: true, subscriptionStatus: true,
          subscriptionStartDate: true, subscriptionEndDate: true, trialStartDate: true,
        },
      }) as unknown as Record<string, unknown>;
    } catch {
      try {
        const rows = await db.$queryRawUnsafe(
          `SELECT id, email, "firstName", "lastName", "avatar", "subscriptionPlan", "subscriptionStatus", "subscriptionStartDate", "subscriptionEndDate", "trialStartDate" FROM "User" WHERE id = $1`,
          userId
        ) as Array<Record<string, unknown>>;
        user = rows[0] || null;
      } catch (err) {
        console.error("[auth/me] Fallback query failed:", err);
      }
    }

    if (!user) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      ...buildSubscriptionInfo(user),
      user: buildSafeUser(user),
    });
  } catch (error) {
    console.error("[auth/me] Error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
