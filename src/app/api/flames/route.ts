import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getCurrentFlameType,
  getFlameProgress,
  COURSE_CREATION_COST,
  FLAME_REWARDS,
  type FlameReward,
} from "@/lib/flames";

/* ── GET /api/flames ──────────────────────────────────────────────────── */

export async function GET() {
  try {
    // 1. Get or create AppSettings row
    const settings = await db.appSettings.upsert({
      where: { id: "main" },
      create: { id: "main", flamePoints: 0 },
      update: {},
    });

    // 2. Get all flame transactions (newest first, last 20)
    const allTransactions = await db.flameTransaction.findMany({
      orderBy: { createdAt: "desc" },
    });

    const transactions = allTransactions.slice(0, 20);
    const totalEarned = allTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = allTransactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0);

    // 3. Compute rewards with isEarned based on current flame points
    const rewards: FlameReward[] = FLAME_REWARDS.map((reward) => ({
      ...reward,
      isEarned: settings.flamePoints >= reward.points,
    }));

    // 4. Build response
    const flamePoints = settings.flamePoints;
    const flameType = getCurrentFlameType(flamePoints);
    const flameProgress = getFlameProgress(flamePoints);

    return NextResponse.json({
      flamePoints,
      flameType,
      flameProgress,
      rewards,
      courseCreationCost: COURSE_CREATION_COST,
      totalEarned,
      totalSpent,
      transactions,
    });
  } catch (error) {
    console.error("Flame GET error:", error);
    return NextResponse.json({ error: "Failed to fetch flame data" }, { status: 500 });
  }
}

/* ── POST /api/flames ─────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, amount, reason, courseId, chapterId } = body as {
      action?: string;
      amount?: number;
      reason?: string;
      courseId?: string;
      chapterId?: string;
    };

    if (!action || !["award", "spend"].includes(action)) {
      return NextResponse.json({ error: 'action must be "award" or "spend"' }, { status: 400 });
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    if (!reason || typeof reason !== "string") {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    // Get or create AppSettings
    const settings = await db.appSettings.upsert({
      where: { id: "main" },
      create: { id: "main", flamePoints: 0 },
      update: {},
    });

    const transactionAmount = action === "award" ? amount : -amount;

    // For spend, check sufficient balance
    if (action === "spend" && settings.flamePoints < amount) {
      return NextResponse.json(
        { error: "Insufficient flame points", currentBalance: settings.flamePoints, requested: amount },
        { status: 400 },
      );
    }

    // Create the flame transaction
    await db.flameTransaction.create({
      data: {
        amount: transactionAmount,
        reason,
        courseId: courseId || null,
        chapterId: chapterId || null,
      },
    });

    // Update AppSettings flame points
    const updatedSettings = await db.appSettings.update({
      where: { id: "main" },
      data: { flamePoints: settings.flamePoints + transactionAmount },
    });

    return NextResponse.json({
      success: true,
      flamePoints: updatedSettings.flamePoints,
    });
  } catch (error) {
    console.error("Flame POST error:", error);
    return NextResponse.json({ error: "Failed to process flame transaction" }, { status: 500 });
  }
}
