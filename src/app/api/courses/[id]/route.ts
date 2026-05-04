import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
      sourceLinks: JSON.parse(course.sourceLinks),
      createdAt: course.createdAt,
      chapters: course.chapters.map((ch) => ({
        id: ch.id,
        title: ch.title,
        content: ch.content,
        summary: ch.summary,
        order: ch.order,
        quiz: ch.quiz
          ? { id: ch.quiz.id, questions: JSON.parse(ch.quiz.questions) }
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
    });
  } catch (error) {
    console.error("Fetch course error:", error);
    return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.course.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete course error:", error);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
