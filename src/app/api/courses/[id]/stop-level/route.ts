import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { level: stopLevel } = await request.json();

    if (stopLevel === undefined || stopLevel < 0) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    const progress = await db.courseProgress.findUnique({
      where: { courseId: id },
    });

    if (!progress) {
      return NextResponse.json({ error: "No progress found" }, { status: 404 });
    }

    await db.courseProgress.update({
      where: { courseId: id },
      data: { stoppedAtLevel: stopLevel },
    });

    return NextResponse.json({ success: true, stoppedAtLevel: stopLevel });
  } catch (error) {
    console.error("[stop-level] Error:", error);
    return NextResponse.json({ error: "Failed to stop level" }, { status: 500 });
  }
}
