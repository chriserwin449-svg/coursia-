import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const certificate = await db.certificate.findUnique({
      where: { id },
    });

    if (!certificate) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    // Get the course owner info (sharer name) if possible
    const course = await db.course.findUnique({
      where: { id: certificate.courseId },
      select: { userId: true },
    });

    let publisherName: string | null = null;
    if (course?.userId) {
      const publisher = await db.user.findUnique({
        where: { id: course.userId },
        select: { firstName: true, lastName: true },
      });
      if (publisher) {
        publisherName = `${publisher.firstName} ${publisher.lastName}`;
      }
    }

    return NextResponse.json({
      id: certificate.id,
      userId: certificate.userId,
      courseId: certificate.courseId,
      courseTitle: certificate.courseTitle,
      userName: certificate.userName,
      score: certificate.score,
      totalLevels: certificate.totalLevels,
      certificateId: certificate.certificateId,
      issuedAt: certificate.issuedAt,
      publisherName,
    });
  } catch (error) {
    console.error("[certificates/id] Error:", error);
    return NextResponse.json({ error: "Failed to fetch certificate" }, { status: 500 });
  }
}
