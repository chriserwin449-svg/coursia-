import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/get-user-id";

/**
 * GET /api/courses/[id]/shares
 * Returns the list of users who have been shared this course.
 * Used to populate the "Shared with" section in ShareCourseDialog.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify course exists and user is the owner
    const course = await db.course.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.userId !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get all shares for this course with recipient user info
    const shares = await db.courseShare.findMany({
      where: { courseId: id },
      orderBy: { createdAt: "desc" },
      include: {
        course: false,
      },
    });

    // Get recipient user details
    const recipientIds = shares.map((s) => s.sharedWith);
    const recipients =
      recipientIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: recipientIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];

    const recipientMap = new Map(recipients.map((u) => [u.id, u]));

    const sharedWith = shares.map((share) => {
      const recipient = recipientMap.get(share.sharedWith);
      return {
        id: share.id,
        userId: share.sharedWith,
        firstName: recipient?.firstName || "Unknown",
        lastName: recipient?.lastName || "",
        email: recipient?.email || "",
        sharedAt: share.createdAt,
      };
    });

    return NextResponse.json({ sharedWith });
  } catch (error) {
    console.error("[courses/shares] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shares" },
      { status: 500 }
    );
  }
}
