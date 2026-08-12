import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHAPTER_COMPLETE_FLAMES, getCurrentFlameType } from "@/lib/flames";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { createNotification } from "@/lib/create-notification";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params;
    const body = await request.json().catch(() => ({}));
    const bodyUserId = body?.userId as string | undefined;
    const userId = getUserIdFromRequest(request, bodyUserId);

    const chapter = await db.chapter.findUnique({
      where: { id: chapterId },
      include: { course: true, progress: true },
    });

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    // If already completed, return early
    if (chapter.progress?.completed) {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        score: chapter.progress.score,
        completed: true,
      });
    }

    // Mark chapter as completed with 100% score (auto-completed by reading)
    const progress = await db.chapterProgress.upsert({
      where: { chapterId },
      create: {
        chapterId,
        completed: true,
        score: 100,
        completedAt: new Date(),
      },
      update: {
        completed: true,
        score: 100,
        completedAt: new Date(),
      },
    });

    // Award flame points if not already awarded
    if (!progress.flameAwarded && userId) {
      const flamePoints = CHAPTER_COMPLETE_FLAMES;
      const settingsId = userId;
      await db.appSettings.upsert({
        where: { id: settingsId },
        create: { id: settingsId, flamePoints },
        update: { flamePoints: { increment: flamePoints } },
      });
      await db.flameTransaction.create({
        data: {
          amount: flamePoints,
          reason: "chapter_complete",
          courseId: chapter.courseId,
          chapterId,
          userId: userId || null,
        },
      });
      await db.chapterProgress.update({
        where: { chapterId },
        data: { flameAwarded: true },
      });

      // Check for flame tier upgrade
      const updated = await db.appSettings.findUnique({ where: { id: settingsId } });
      if (updated) {
        const prevType = getCurrentFlameType(updated.flamePoints - flamePoints);
        const newType = getCurrentFlameType(updated.flamePoints);
        if (prevType.id !== newType.id) {
          await createNotification({ userId, type: "flame_tier_up", title: `${newType.emoji} ${newType.name}`, message: `You reached ${updated.flamePoints} flame points!`, data: { points: updated.flamePoints, tierId: newType.id } });
        }
        // Notify flame points earned
        await createNotification({ userId, type: "flame_points_earned", title: `🔥 +${flamePoints}`, message: `Chapter completed! +${flamePoints} flame points`, data: { points: flamePoints, reason: "chapter_complete", courseId: chapter.courseId } });
      }
    }

    // Count total completed chapters in course
    const totalChapters = await db.chapter.count({
      where: { courseId: chapter.courseId },
    });
    const completedChapters = await db.chapter.count({
      where: {
        courseId: chapter.courseId,
        progress: { completed: true },
      },
    });

    const allDone = completedChapters === totalChapters;

    return NextResponse.json({
      success: true,
      completed: true,
      score: 100,
      completedChapters,
      totalChapters,
      allChaptersCompleted: allDone,
      overallProgress: Math.round((completedChapters / totalChapters) * 100),
    });
  } catch (error) {
    console.error("Chapter complete error:", error);
    return NextResponse.json({ error: "Failed to complete chapter" }, { status: 500 });
  }
}