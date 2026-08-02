import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_request: NextRequest) {
  try {
    const publicCourses = await db.publicCourse.findMany({
      orderBy: { publishedAt: "desc" },
      include: {
        course: {
          include: {
            chapters: {
              select: { id: true },
            },
          },
        },
      },
    });

    // Get publisher names
    const publisherIds = [...new Set(publicCourses.map((pc) => pc.publishedBy))];
    const publishers =
      publisherIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: publisherIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
    const publisherMap = new Map(publishers.map((u) => [u.id, u]));

    // Increment views for each course
    if (publicCourses.length > 0) {
      await db.publicCourse.updateMany({
        where: { id: { in: publicCourses.map((pc) => pc.id) } },
        data: { views: { increment: 1 } },
      });
    }

    const courses = publicCourses.map((pc) => {
      const publisher = publisherMap.get(pc.publishedBy);
      return {
        courseId: pc.courseId,
        title: pc.course.title,
        description: pc.course.description,
        chapterCount: pc.course.chapters.length,
        publishedAt: pc.publishedAt,
        views: pc.views + 1, // reflect the just-incremented value
        publisherName: publisher
          ? `${publisher.firstName} ${publisher.lastName}`
          : "Unknown",
      };
    });

    return NextResponse.json({ courses });
  } catch (error) {
    console.error("[courses/open] Error:", error);
    return NextResponse.json({ error: "Failed to fetch open courses" }, { status: 500 });
  }
}
