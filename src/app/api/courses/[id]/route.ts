import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function safeJsonParse(str: string, fallback: unknown = []): unknown {
  try { return JSON.parse(str); } catch { return fallback; }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const course = await db.course.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { order: "asc" },
          include: { quiz: true, progress: true },
        },
        finalQuiz: true,
        progress: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const totalChapters = course.chapters.length;
    const completedChapters = course.chapters.filter(
      (ch) => ch.progress?.completed
    ).length;
    const overallProgress =
      totalChapters > 0
        ? Math.round((completedChapters / totalChapters) * 100)
        : 0;

    return NextResponse.json({
      id: course.id,
      title: course.title,
      description: course.description,
      sourceLinks: safeJsonParse(course.sourceLinks) as string[],
      level: course.level,
      createdAt: course.createdAt,
      chapters: course.chapters.map((ch) => ({
        id: ch.id,
        title: ch.title,
        content: ch.content,
        summary: ch.summary,
        order: ch.order,
        level: ch.level ?? 0,
        quiz: ch.quiz
          ? { id: ch.quiz.id, questions: safeJsonParse(ch.quiz.questions) }
          : null,
        progress: ch.progress
          ? {
              completed: ch.progress.completed,
              score: ch.progress.score,
              completedAt: ch.progress.completedAt?.toISOString(),
            }
          : null,
      })),
      overallProgress,
      courseCompleted: course.progress?.completed ?? false,
      courseScore: course.progress?.score ?? 0,
      maxUnlockedLevel: course.progress?.maxUnlockedLevel ?? 0,
      stoppedAtLevel: course.progress?.stoppedAtLevel ?? -1,
    });
  } catch (error) {
    console.error("Fetch course error:", error);
    return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify the course exists and belongs to the user
    const course = await db.course.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!course) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // If course has an owner, verify the requester is the owner
    if (course.userId) {
      const authHeader = request.headers.get("Authorization");
      const requestUserId = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
      if (requestUserId !== course.userId) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    }
    // Note: NEVER modify freeCourseUsed on course deletion

    await db.course.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete course error:", error);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
