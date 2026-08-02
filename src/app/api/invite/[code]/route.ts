import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/invite/[code]
 * Resolve an invitation link code.
 * Returns course info without requiring auth (for the landing flow).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || code.length < 4) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 400 }
      );
    }

    // Find the invitation link
    const inviteLink = await db.invitationLink.findUnique({
      where: { code },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            userId: true,
            chapters: {
              select: { id: true, title: true, level: true, order: true },
              orderBy: { order: "asc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!inviteLink) {
      return NextResponse.json(
        { error: "Invitation link not found or expired" },
        { status: 404 }
      );
    }

    // Increment use count
    await db.invitationLink.update({
      where: { id: inviteLink.id },
      data: { useCount: { increment: 1 } },
    });

    // Get sharer info
    const sharer = await db.user.findUnique({
      where: { id: inviteLink.course.userId || "" },
      select: { id: true, firstName: true, lastName: true },
    });

    return NextResponse.json({
      success: true,
      courseId: inviteLink.course.id,
      courseTitle: inviteLink.course.title,
      courseDescription: inviteLink.course.description,
      sharedBy: sharer
        ? `${sharer.firstName} ${sharer.lastName}`
        : "Unknown",
      sharedById: inviteLink.createdBy,
    });
  } catch (error) {
    console.error("[invite] Error:", error);
    return NextResponse.json(
      { error: "Failed to resolve invitation" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invite/[code]
 * Called after a user is authenticated to create a CourseShare record.
 * This grants the authenticated user access to the shared course.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    // Get userId from Authorization header
    const authHeader = request.headers.get("authorization");
    const userId = authHeader?.replace("Bearer ", "");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the invitation link
    const inviteLink = await db.invitationLink.findUnique({
      where: { code },
      include: { course: { select: { id: true, userId: true } } },
    });

    if (!inviteLink) {
      return NextResponse.json(
        { error: "Invitation link not found" },
        { status: 404 }
      );
    }

    // Check for existing share
    const existingShare = await db.courseShare.findFirst({
      where: {
        courseId: inviteLink.courseId,
        sharedWith: userId,
      },
    });

    if (existingShare) {
      return NextResponse.json({
        success: true,
        courseId: inviteLink.courseId,
        alreadyShared: true,
      });
    }

    // Create the CourseShare
    await db.courseShare.create({
      data: {
        courseId: inviteLink.courseId,
        sharedBy: inviteLink.createdBy,
        sharedWith: userId,
        message: "Shared via invitation link",
        isRead: true,
      },
    });

    return NextResponse.json({
      success: true,
      courseId: inviteLink.courseId,
      alreadyShared: false,
    });
  } catch (error) {
    console.error("[invite] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
