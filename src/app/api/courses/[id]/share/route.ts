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
    const { sharedWith, message } = body;

    if (!sharedWith) {
      return NextResponse.json({ error: "sharedWith is required" }, { status: 400 });
    }

    // Verify the course exists and belongs to the sharing user
    const course = await db.course.findUnique({
      where: { id },
      select: { userId: true, title: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.userId !== userId) {
      return NextResponse.json({ error: "You can only share your own courses" }, { status: 403 });
    }

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

    // Create the share
    const share = await db.courseShare.create({
      data: {
        courseId: id,
        sharedBy: userId,
        sharedWith,
        message: message || null,
        isRead: false,
      },
    });

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
