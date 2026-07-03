import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateLevelCompletionBonus, calculateMasteryBonus } from "@/lib/flames";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { level } = await request.json();

    if (level === undefined || level < 0 || level > 2) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    const course = await db.course.findUnique({
      where: { id },
      include: { progress: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Check if this level bonus was already awarded (stored in progress)
    const progress = course.progress;
    const awardedLevels: number[] = progress?.flameAwardedLevels
      ? (typeof progress.flameAwardedLevels === "string"
          ? JSON.parse(progress.flameAwardedLevels)
          : progress.flameAwardedLevels)
      : [];

    if (awardedLevels.includes(level)) {
      return NextResponse.json({ success: true, alreadyAwarded: true, message: "Level bonus already awarded" });
    }

    // Calculate bonus
    let bonusPoints: number;
    let reason: string;

    if (level >= 2) {
      // All levels mastered — big bonus
      bonusPoints = calculateLevelCompletionBonus(level) + calculateMasteryBonus();
      reason = "all_levels_mastered";
    } else {
      bonusPoints = calculateLevelCompletionBonus(level);
      reason = "level_complete";
    }

    // Award flame points
    await db.appSettings.upsert({
      where: { id: "main" },
      create: { id: "main", flamePoints: bonusPoints },
      update: { flamePoints: { increment: bonusPoints } },
    });

    await db.flameTransaction.create({
      data: {
        amount: bonusPoints,
        reason,
        courseId: id,
      },
    });

    // Mark level as awarded
    const updatedAwarded = [...awardedLevels, level];
    // @ts-expect-error - flameAwardedLevels is a JSON field
    await db.courseProgress.upsert({
      where: { courseId: id },
      create: { courseId: id },
      update: {
        // @ts-expect-error - flameAwardedLevels is a JSON field
        flameAwardedLevels: JSON.stringify(updatedAwarded),
      },
    });

    return NextResponse.json({
      success: true,
      bonusPoints,
      reason,
      level,
    });
  } catch (error) {
    console.error("[complete-level] Error:", error);
    return NextResponse.json({ error: "Failed to award level bonus" }, { status: 500 });
  }
}