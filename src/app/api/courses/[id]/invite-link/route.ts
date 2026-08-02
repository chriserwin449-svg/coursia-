import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import crypto from "crypto";

/**
 * POST /api/courses/[id]/invite-link
 * Generate a unique invitation link for a course.
 */
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

    // Verify course exists and user is the owner
    const course = await db.course.findUnique({
      where: { id },
      select: { userId: true, title: true, description: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.userId !== userId) {
      return NextResponse.json(
        { error: "Only the course owner can generate invite links" },
        { status: 403 }
      );
    }

    // Check if there's already an active link for this course by this user
    const existingLink = await db.invitationLink.findFirst({
      where: {
        courseId: id,
        createdBy: userId,
        useCount: { lt: 100 }, // not exhausted
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingLink) {
      return NextResponse.json({
        success: true,
        code: existingLink.code,
        url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/?invite=${existingLink.code}`,
        courseTitle: course.title,
        courseDescription: course.description,
      });
    }

    // Generate a unique 6-char alphanumeric code
    let code: string;
    let codeExists = true;
    while (codeExists) {
      code = crypto.randomBytes(3).toString("hex").slice(0, 6).toUpperCase();
      const existing = await db.invitationLink.findUnique({
        where: { code },
      });
      codeExists = !!existing;
    }

    // Create the invitation link
    await db.invitationLink.create({
      data: {
        code: code!,
        courseId: id,
        createdBy: userId,
        maxUses: 100,
        useCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      code: code!,
      url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/?invite=${code!}`,
      courseTitle: course.title,
      courseDescription: course.description,
    });
  } catch (error) {
    console.error("[courses/invite-link] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate invite link" },
      { status: 500 }
    );
  }
}
