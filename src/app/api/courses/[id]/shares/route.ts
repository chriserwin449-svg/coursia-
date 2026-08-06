import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

async function ensureCourseShareTable(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.startsWith("file:")) return;
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CourseShare" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "courseId" TEXT NOT NULL,
        "sharedBy" TEXT NOT NULL,
        "sharedWith" TEXT NOT NULL,
        "message" TEXT,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch { /* ignore */ }
}

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
    await ensureCourseShareTable();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || request.headers.get("Authorization")?.replace("Bearer ", "") || "";

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

    // Check authorization: allow both course owner and recipients
    const isOwner = course.userId === userId;
    let isRecipient = false;
    if (!isOwner) {
      const existingShare = await db.courseShare.findFirst({
        where: { courseId: id, sharedWith: userId },
        select: { id: true },
      });
      isRecipient = !!existingShare;
    }

    if (!isOwner && !isRecipient) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get all shares for this course with recipient user info
    const shares = await db.courseShare.findMany({
      where: { courseId: id },
      orderBy: { createdAt: "desc" },
    });

    // Get recipient user details with avatar
    const recipientIds = shares.map((s) => s.sharedWith);
    const recipients =
      recipientIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: recipientIds } },
            select: { id: true, firstName: true, lastName: true, email: true, username: true, avatar: true },
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
        username: recipient?.username || null,
        avatar: recipient?.avatar || null,
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
