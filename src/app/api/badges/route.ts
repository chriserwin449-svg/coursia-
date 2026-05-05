import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEarnedBadges, getNextBadge, getBadgeProgress } from "@/lib/badges";

export async function GET() {
  try {
    const courses = await db.course.findMany({
      include: {
        chapters: {
          include: { progress: true },
        },
      },
    });

    const totalCourses = courses.length;
    const completedCourses = courses.filter((course) =>
      course.chapters.length > 0 &&
      course.chapters.every((ch) => ch.progress?.completed)
    ).length;

    const totalChapters = courses.reduce((sum, c) => sum + c.chapters.length, 0);
    const completedChapters = courses.reduce(
      (sum, c) => sum + c.chapters.filter((ch) => ch.progress?.completed).length,
      0
    );

    const totalStudyTime = completedChapters * 15; // estimated 15 min per chapter
    const averageScore = courses.reduce((sum, c) => {
      const chapterScores = c.chapters
        .filter((ch) => ch.progress?.score !== undefined && ch.progress?.score > 0)
        .map((ch) => ch.progress!.score);
      if (chapterScores.length === 0) return sum;
      return sum + chapterScores.reduce((a, b) => a + b, 0) / chapterScores.length;
    }, 0) / (courses.filter((c) => c.chapters.some((ch) => ch.progress?.score && ch.progress.score > 0)).length || 1);

    const earnedBadges = getEarnedBadges(completedCourses);
    const nextBadge = getNextBadge(completedCourses);
    const badgeProgress = getBadgeProgress(completedCourses);

    return NextResponse.json({
      stats: {
        totalCourses,
        completedCourses,
        totalChapters,
        completedChapters,
        totalStudyTime,
        averageScore: Math.round(averageScore),
        flamePoints: 0, // flame points are fetched from /api/flames
      },
      badges: {
        earned: earnedBadges,
        all: earnedBadges.map((b) => ({
          ...b,
          earned: true,
        })),
        next: nextBadge,
        progress: badgeProgress,
      },
    });
  } catch (error) {
    console.error("Badges error:", error);
    return NextResponse.json({ error: "Failed to fetch badges" }, { status: 500 });
  }
}
