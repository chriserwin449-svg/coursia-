import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LEVEL_COMPLETE_FLAMES, COURSE_MASTERY_FLAMES, getCurrentFlameType } from "@/lib/flames";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { createNotification } from "@/lib/create-notification";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { level, userId: bodyUserId } = await request.json();

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
    let awardedLevels: number[] = [];
    try {
      awardedLevels = progress?.flameAwardedLevels
        ? (typeof progress.flameAwardedLevels === "string"
            ? JSON.parse(progress.flameAwardedLevels)
            : Array.isArray(progress.flameAwardedLevels) ? progress.flameAwardedLevels : [])
        : [];
    } catch {
      awardedLevels = [];
    }

    if (awardedLevels.includes(level)) {
      return NextResponse.json({ success: true, alreadyAwarded: true, message: "Level bonus already awarded" });
    }

    // Calculate bonus
    let bonusPoints: number;
    let reason: string;

    if (level >= 2) {
      // All levels mastered — big bonus
      bonusPoints = LEVEL_COMPLETE_FLAMES + COURSE_MASTERY_FLAMES;
      reason = "all_levels_mastered";
    } else {
      bonusPoints = LEVEL_COMPLETE_FLAMES;
      reason = "level_complete";
    }

    // Get userId from body, header, or query param
    const userId = getUserIdFromRequest(request, bodyUserId);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settingsId = userId;

    // Award flame points per-user
    await db.appSettings.upsert({
      where: { id: settingsId },
      create: { id: settingsId, flamePoints: bonusPoints },
      update: { flamePoints: { increment: bonusPoints } },
    });

    await db.flameTransaction.create({
      data: {
        amount: bonusPoints,
        reason,
        courseId: id,
        userId: userId,
      },
    });

    // Mark level as awarded
    const updatedAwarded = [...awardedLevels, level];
    await db.courseProgress.upsert({
      where: { courseId: id },
      create: { courseId: id },
      update: {
        flameAwardedLevels: JSON.stringify(updatedAwarded),
      },
    });

    // Check for flame tier upgrade
    const updated = await db.appSettings.findUnique({ where: { id: userId } });
    if (updated) {
      const prevType = getCurrentFlameType(updated.flamePoints - bonusPoints);
      const newType = getCurrentFlameType(updated.flamePoints);
      if (prevType.id !== newType.id) {
        await createNotification({ userId, type: "flame_tier_up", title: `${newType.emoji} ${newType.name}`, message: `You reached ${updated.flamePoints} flame points!`, data: { points: updated.flamePoints, tierId: newType.id } });
      }
    }

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