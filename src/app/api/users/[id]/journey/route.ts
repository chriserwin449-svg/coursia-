import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEarnedBadges, getNextBadge, getBadgeProgress } from "@/lib/badges";

/**
 * GET /api/users/[id]/journey
 * Returns a user's public profile for journey viewing.
 * Shows their stats, badges, and course list (without course content).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify the user exists
    const targetUser = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch courses (without content to keep payload small)
    const courses = await db.course.findMany({
      where: { userId: id },
      select: {
        id: true,
        title: true,
        description: true,
        level: true,
        createdAt: true,
        chapters: {
          select: {
            order: true,
            title: true,
            progress: {
              select: {
                completed: true,
                score: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
        progress: {
          select: {
            completed: true,
            score: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute stats
    const totalCourses = courses.length;
    const completedCourses = courses.filter(
      (c) =>
        c.progress?.completed ||
        (c.chapters.length > 0 && c.chapters.every((ch) => ch.progress?.completed))
    ).length;

    const activeCourses = courses.filter((c) => {
      if (c.progress?.completed) return false;
      if (c.chapters.length > 0 && c.chapters.every((ch) => ch.progress?.completed)) return false;
      return true;
    }).length;

    const totalChapters = courses.reduce((sum, c) => sum + c.chapters.length, 0);
    const completedChapters = courses.reduce(
      (sum, c) => sum + c.chapters.filter((ch) => ch.progress?.completed).length,
      0
    );

    // Study sessions for time tracking
    const sessions = await db.studySession.findMany({
      where: { userId: id, endTime: { not: null } },
    });
    const totalStudyTime = sessions.reduce((sum, s) => {
      if (s.durationSeconds > 0) return sum + s.durationSeconds / 60;
      if (s.endTime) return sum + Math.max(0, (s.endTime.getTime() - s.startTime.getTime()) / 60000);
      return sum;
    }, 0);

    // Average score
    const averageScore =
      courses.reduce((sum, c) => {
        const chapterScores = c.chapters
          .filter((ch) => ch.progress?.score !== undefined && ch.progress?.score > 0)
          .map((ch) => ch.progress!.score);
        if (chapterScores.length === 0) return sum;
        return sum + chapterScores.reduce((a, b) => a + b, 0) / chapterScores.length;
      }, 0) /
      (courses.filter((c) => c.chapters.some((ch) => ch.progress?.score && ch.progress.score > 0)).length || 1);

    // Badges
    const earnedBadges = getEarnedBadges(completedCourses);
    const nextBadge = getNextBadge(completedCourses);
    const badgeProgress = getBadgeProgress(completedCourses);

    // Flame points (public)
    const flameTransactions = await db.flameTransaction.findMany({
      where: { userId: id },
    });
    const totalFlamePoints = flameTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Build course list for display (no content, just metadata)
    const courseList = courses.map((c) => {
      const completed = c.chapters.filter((ch) => ch.progress?.completed).length;
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        level: c.level,
        chapterCount: c.chapters.length,
        completedChapters: completed,
        overallProgress: c.chapters.length > 0 ? Math.round((completed / c.chapters.length) * 100) : 0,
        courseCompleted: c.progress?.completed ?? false,
        createdAt: c.createdAt,
      };
    });

    return NextResponse.json({
      user: {
        id: targetUser.id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        username: targetUser.username,
        avatar: targetUser.avatar,
        memberSince: targetUser.createdAt,
      },
      stats: {
        totalCourses,
        completedCourses,
        activeCourses,
        totalChapters,
        completedChapters,
        totalStudyTime: Math.round(totalStudyTime),
        averageScore: Math.round(averageScore),
        totalFlamePoints,
      },
      badges: {
        earned: earnedBadges,
        all: earnedBadges.map((b) => ({ ...b, earned: true })),
        next: nextBadge,
        progress: badgeProgress,
      },
      courses: courseList,
    });
  } catch (error) {
    console.error("[users/journey] Error:", error);
    return NextResponse.json({ error: "Failed to fetch user journey" }, { status: 500 });
  }
}
