import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/get-user-id";

function generateCertificateId(): string {
  const hex = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join("");
  return `CRS-${hex}`;
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    // Get course with progress
    const course = await db.course.findUnique({
      where: { id: courseId },
      include: { progress: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Check if user has completed the course
    const progress = course.progress;
    if (!progress?.completed) {
      return NextResponse.json(
        { error: "Course not yet completed. Complete all levels first." },
        { status: 400 }
      );
    }

    // Check if certificate already exists
    const existingCert = await db.certificate.findFirst({
      where: { userId, courseId },
    });

    if (existingCert) {
      return NextResponse.json({ error: "Certificate already generated for this course" }, { status: 409 });
    }

    // Get user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate unique certificate ID
    let certificateId = generateCertificateId();
    let attempts = 0;
    while (await db.certificate.findUnique({ where: { certificateId } })) {
      certificateId = generateCertificateId();
      attempts++;
      if (attempts > 10) {
        return NextResponse.json({ error: "Failed to generate unique certificate ID" }, { status: 500 });
      }
    }

    // Determine total levels from course
    const totalLevels = Math.max(course.level + 1, 1);

    // Create the certificate
    const certificate = await db.certificate.create({
      data: {
        userId,
        courseId,
        courseTitle: course.title,
        userName: `${user.firstName} ${user.lastName}`,
        score: progress.score,
        totalLevels,
        certificateId,
      },
    });

    return NextResponse.json({
      success: true,
      certificate: {
        id: certificate.id,
        courseTitle: certificate.courseTitle,
        userName: certificate.userName,
        score: certificate.score,
        totalLevels: certificate.totalLevels,
        certificateId: certificate.certificateId,
        issuedAt: certificate.issuedAt,
      },
    });
  } catch (error) {
    console.error("[certificates/generate] Error:", error);
    return NextResponse.json({ error: "Failed to generate certificate" }, { status: 500 });
  }
}
