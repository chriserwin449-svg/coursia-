import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/get-user-id";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { publish } = body;

    if (typeof publish !== "boolean") {
      return NextResponse.json({ error: "publish (boolean) is required" }, { status: 400 });
    }

    // Verify course ownership
    const course = await db.course.findUnique({
      where: { id },
      select: { userId: true, title: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.userId !== userId) {
      return NextResponse.json({ error: "You can only publish your own courses" }, { status: 403 });
    }

    if (publish) {
      // Check if already published
      const existing = await db.publicCourse.findUnique({
        where: { courseId: id },
      });

      if (existing) {
        return NextResponse.json({
          success: true,
          published: true,
          publishedAt: existing.publishedAt,
          views: existing.views,
        });
      }

      const published = await db.publicCourse.create({
        data: {
          courseId: id,
          publishedBy: userId,
        },
      });

      return NextResponse.json({
        success: true,
        published: true,
        publishedAt: published.publishedAt,
        views: 0,
      });
    } else {
      // Unpublish: delete the PublicCourse record
      await db.publicCourse.deleteMany({
        where: { courseId: id },
      });

      return NextResponse.json({
        success: true,
        published: false,
      });
    }
  } catch (error) {
    console.error("[courses/publish] Error:", error);
    return NextResponse.json({ error: "Failed to update publish state" }, { status: 500 });
  }
}
