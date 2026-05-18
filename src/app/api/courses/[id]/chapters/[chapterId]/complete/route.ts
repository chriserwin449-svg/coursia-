import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateFlameEarned } from "@/lib/flames";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params;

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
    if (!progress.flameAwarded) {
      const flamePoints = calculateFlameEarned(100);
      await db.appSettings.upsert({
        where: { id: "main" },
        create: { id: "main", flamePoints },
        update: { flamePoints: { increment: flamePoints } },
      });
      await db.flameTransaction.create({
        data: {
          amount: flamePoints,
          reason: "chapter_complete",
          courseId: chapter.courseId,
          chapterId,
        },
      });
      await db.chapterProgress.update({
        where: { chapterId },
        data: { flameAwarded: true },
      });
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
