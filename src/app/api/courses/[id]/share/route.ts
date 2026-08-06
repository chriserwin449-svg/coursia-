import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/get-user-id";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureCourseShareTable();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { sharedWith, message } = body;

    console.log(`[share] Attempt: userId=${userId}, courseId=${id}, sharedWith=${sharedWith}`);

    if (!sharedWith) {
      return NextResponse.json({ error: "sharedWith is required" }, { status: 400 });
    }

    // Verify the course exists
    const course = await db.course.findUnique({
      where: { id },
      select: { userId: true, title: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Check authorization: user must be the course owner OR a recipient of a previous share
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
      console.warn(`[share] Access denied: course.userId=${course.userId}, request userId=${userId}, isOwner=${isOwner}, isRecipient=${isRecipient}`);
      return NextResponse.json({ error: "You can only share courses you own or have received" }, { status: 403 });
    }

    console.log(`[share] Access granted: isOwner=${isOwner}, isRecipient=${isRecipient}`);

    // Verify the recipient user exists
    const targetUser = await db.user.findUnique({
      where: { id: sharedWith },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Recipient user not found" }, { status: 404 });
    }

    // Prevent sharing with yourself
    if (sharedWith === userId) {
      return NextResponse.json({ error: "You cannot share a course with yourself" }, { status: 400 });
    }

    // Prevent duplicate shares
    const existingShare = await db.courseShare.findFirst({
      where: {
        courseId: id,
        sharedWith,
      },
    });

    if (existingShare) {
      return NextResponse.json({ error: "Course already shared with this user" }, { status: 409 });
    }

    // Create the share (sharedBy = original owner if forwarded, else the current user)
    const share = await db.courseShare.create({
      data: {
        courseId: id,
        sharedBy: userId,
        sharedWith,
        message: message || null,
        isRead: false,
      },
    });

    console.log(`[share] Success: shareId=${share.id}, courseId=${id}, sharedBy=${userId}, sharedWith=${sharedWith}`);

    return NextResponse.json({
      success: true,
      share: {
        id: share.id,
        courseId: share.courseId,
        sharedBy: share.sharedBy,
        sharedWith: share.sharedWith,
        message: share.message,
        isRead: share.isRead,
        createdAt: share.createdAt,
      },
    });
  } catch (error) {
    console.error("[courses/share] Error:", error);
    return NextResponse.json({ error: "Failed to share course" }, { status: 500 });
  }
}
