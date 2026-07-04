import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEarnedBadges, getNextBadge, getBadgeProgress } from "@/lib/badges";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    const courses = await db.course.findMany({
      ...(userId ? { where: { userId } } : {}),
      include: {
        chapters: {
          include: { progress: true },
        },
        progress: true,
      },
    });

    const totalCourses = courses.length;

    const completedCourses = courses.filter((course) =>
      course.progress?.completed ||
      (course.chapters.length > 0 &&
      course.chapters.every((ch) => ch.progress?.completed))
    ).length;

    // Active courses = courses that are NOT fully completed
    const activeCourses = courses.filter((course) => {
      if (course.progress?.completed) return false;
      // If there are chapters and ALL are completed, it's done
      if (course.chapters.length > 0 && course.chapters.every((ch) => ch.progress?.completed)) return false;
      return true;
    }).length;

    const totalChapters = courses.reduce((sum, c) => sum + c.chapters.length, 0);
    const completedChapters = courses.reduce(
      (sum, c) => sum + c.chapters.filter((ch) => ch.progress?.completed).length,
      0
    );

    const sessionsWhere: Record<string, unknown> = { endTime: { not: null } };
    if (userId) sessionsWhere.userId = userId;
    const sessions = await db.studySession.findMany({ where: sessionsWhere });
    const totalStudyTime = sessions.reduce((sum, s) => {
      if (s.durationSeconds > 0) return sum + s.durationSeconds / 60;
      if (s.endTime) return sum + Math.max(0, (s.endTime.getTime() - s.startTime.getTime()) / 60000);
      return sum;
    }, 0);

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
        activeCourses,
        totalChapters,
        completedChapters,
        totalStudyTime: Math.round(totalStudyTime),
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