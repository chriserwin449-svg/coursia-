import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Fetch all shares for this user with course details
    const shares = await db.courseShare.findMany({
      where: { sharedWith: userId },
      orderBy: { createdAt: "desc" },
      include: {
        course: {
          include: {
            chapters: {
              orderBy: { order: "asc" },
              include: { progress: true },
            },
            progress: true,
          },
        },
      },
    });

    // Get sharer user info
    const sharerIds = [...new Set(shares.map((s) => s.sharedBy))];
    const sharers = sharerIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: sharerIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const sharerMap = new Map(sharers.map((u) => [u.id, u]));

    // Mark all as read
    const unreadIds = shares.filter((s) => !s.isRead).map((s) => s.id);
    if (unreadIds.length > 0) {
      await db.courseShare.updateMany({
        where: { id: { in: unreadIds } },
        data: { isRead: true },
      });
    }

    // Build response
    const sharedCourses = shares.map((share) => {
      const course = share.course;
      const totalChapters = course.chapters.length;
      const completedChapters = course.chapters.filter(
        (ch) => ch.progress?.completed
      ).length;
      const overallProgress =
        totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

      const sharer = sharerMap.get(share.sharedBy);

      return {
        id: share.id,
        courseId: course.id,
        courseTitle: course.title,
        courseDescription: course.description,
        chapterCount: totalChapters,
        overallProgress,
        courseCompleted: course.progress?.completed ?? false,
        message: share.message,
        sharedBy: share.sharedBy,
        sharedByName: sharer
          ? `${sharer.firstName} ${sharer.lastName}`
          : "Unknown",
        sharedAt: share.createdAt,
        wasUnread: !share.isRead,
      };
    });

    return NextResponse.json({ sharedCourses });
  } catch (error) {
    console.error("[courses/shared] Error:", error);
    return NextResponse.json({ error: "Failed to fetch shared courses" }, { status: 500 });
  }
}
