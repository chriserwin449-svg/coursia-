import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 3 days ago start
    const threeDaysStart = new Date(todayStart);
    threeDaysStart.setDate(threeDaysStart.getDate() - 2);
    threeDaysStart.setHours(0, 0, 0, 0);
    
    // This week start (Monday)
    const weekStart = new Date(todayStart);
    const dayOfWeek = weekStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    
    // This month start
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all study sessions
    const sessions = await db.studySession.findMany({
      where: {
        endTime: { not: null },
      },
      orderBy: { startTime: "desc" },
    });

    const getSessionMinutes = (session: { startTime: Date; endTime: Date | null; durationSeconds: number }) => {
      if (session.durationSeconds > 0) return session.durationSeconds / 60;
      if (session.endTime) {
        return Math.max(0, (session.endTime.getTime() - session.startTime.getTime()) / 60000);
      }
      return 0;
    };

    // Calculate totals for each period
    const today = sessions
      .filter(s => s.startTime >= todayStart)
      .reduce((sum, s) => sum + getSessionMinutes(s), 0);

    const last3Days = sessions
      .filter(s => s.startTime >= threeDaysStart)
      .reduce((sum, s) => sum + getSessionMinutes(s), 0);

    const thisWeek = sessions
      .filter(s => s.startTime >= weekStart)
      .reduce((sum, s) => sum + getSessionMinutes(s), 0);

    const thisMonth = sessions
      .filter(s => s.startTime >= monthStart)
      .reduce((sum, s) => sum + getSessionMinutes(s), 0);

    // Daily breakdown for last 30 days
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    
    const dailyMap = new Map<string, { minutes: number; courses: Set<string> }>();
    
    sessions
      .filter(s => s.startTime >= thirtyDaysAgo)
      .forEach(s => {
        const dateKey = s.startTime.toISOString().split("T")[0];
        const existing = dailyMap.get(dateKey) || { minutes: 0, courses: new Set<string>() };
        existing.minutes += getSessionMinutes(s);
        if (s.courseId) existing.courses.add(s.courseId);
        dailyMap.set(dateKey, existing);
      });

    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        minutes: Math.round(data.minutes),
        courses: data.courses.size,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      today: Math.round(today),
      last3Days: Math.round(last3Days),
      thisWeek: Math.round(thisWeek),
      thisMonth: Math.round(thisMonth),
      dailyBreakdown,
    });
  } catch (error) {
    console.error("Study time error:", error);
    return NextResponse.json({ error: "Failed to fetch study time" }, { status: 500 });
  }
}

/* ── POST /api/study-time — Start or end a study session ── */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, courseId, chapterId, sessionId } = body as {
      action: "start" | "end";
      courseId: string;
      chapterId?: string;
      sessionId?: string;
    };

    if (!action || !courseId) {
      return NextResponse.json({ error: "action and courseId are required" }, { status: 400 });
    }

    if (action === "start") {
      const session = await db.studySession.create({
        data: {
          courseId,
          chapterId: chapterId || null,
          startTime: new Date(),
        },
      });
      return NextResponse.json({ success: true, sessionId: session.id });
    }

    if (action === "end") {
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required for end action" }, { status: 400 });
      }
      
      const session = await db.studySession.findUnique({ where: { id: sessionId } });
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      
      const endTime = new Date();
      const durationSeconds = Math.round(
        (endTime.getTime() - session.startTime.getTime()) / 1000
      );
      
      await db.studySession.update({
        where: { id: sessionId },
        data: { endTime, durationSeconds },
      });

      return NextResponse.json({ success: true, durationSeconds });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Study session error:", error);
    return NextResponse.json({ error: "Failed to process study session" }, { status: 500 });
  }
}
