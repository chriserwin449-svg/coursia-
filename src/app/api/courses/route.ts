import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function safeJsonParse(str: string, fallback: unknown = []): unknown {
  try { return JSON.parse(str); } catch { return fallback; }
}

export async function GET() {
  try {
    const courses = await db.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        chapters: {
          orderBy: { order: "asc" },
          include: { progress: true },
        },
      },
    });

    const coursesWithProgress = courses.map((course) => {
      const totalChapters = course.chapters.length;
      const completedChapters = course.chapters.filter(
        (ch) => ch.progress?.completed
      ).length;
      const overallProgress =
        totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        sourceLinks: safeJsonParse(course.sourceLinks) as string[],
        createdAt: course.createdAt,
        chapters: course.chapters.map((ch) => ({
          id: ch.id,
          title: ch.title,
          content: ch.content,
          summary: ch.summary,
          order: ch.order,
          progress: ch.progress
            ? {
                completed: ch.progress.completed,
                score: ch.progress.score,
                completedAt: ch.progress.completedAt?.toISOString(),
              }
            : null,
        })),
        overallProgress,
      };
    });

    return NextResponse.json({ courses: coursesWithProgress });
  } catch (error) {
    console.error("Fetch courses error:", error);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}
