import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { STUDY_TIME_GOOD_FLAMES, STUDY_TIME_SHORT_PENALTY, STUDY_TIME_GOOD_THRESHOLD, STUDY_TIME_SHORT_THRESHOLD, getCurrentFlameType } from "@/lib/flames";

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    
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

    // Fetch study sessions for THIS USER ONLY
    const where = userId
      ? { endTime: { not: null }, userId }
      : { endTime: { not: null } };

    const sessions = await db.studySession.findMany({
      where,
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
      dailyBreakdown: dailyBreakdown || [],
    });
  } catch (error) {
    console.error("Study time error:", error);
    return NextResponse.json({ error: "Failed to fetch study time" }, { status: 500 });
  }
}

/* ── POST /api/study-time — Start or end a study session ── */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, courseId, chapterId, sessionId, userId } = body as {
      action: "start" | "end";
      courseId: string;
      chapterId?: string;
      sessionId?: string;
      userId?: string;
    };

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }
    if (action === "start" && !courseId) {
      return NextResponse.json({ error: "courseId is required for start action" }, { status: 400 });
    }

    if (action === "start") {
      // ── CRITICAL: Verify course exists BEFORE creating session (P2003 prevention) ──
      const existingCourse = await db.course.findUnique({
        where: { id: courseId },
      });
      if (!existingCourse) {
        console.error(`[study-time] P2003 prevention: course "${courseId}" does not exist, refusing to create StudySession`);
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }

      const session = await db.studySession.create({
        data: {
          courseId,
          chapterId: chapterId || null,
          userId: userId || null,
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

      // Award or penalize flames based on session duration (only once per session)
      if (!session.flameAwarded) {
        const userId = getUserIdFromRequest(request, body.userId);
        let flameDelta = 0;
        let reason = "";

        if (durationSeconds >= STUDY_TIME_GOOD_THRESHOLD) {
          // Good study session (>= 10 min): +5 flames
          flameDelta = STUDY_TIME_GOOD_FLAMES;
          reason = "study_time_good";
        } else if (durationSeconds < STUDY_TIME_SHORT_THRESHOLD) {
          // Very short session (< 2 min): -1 flame (but never below 0)
          flameDelta = STUDY_TIME_SHORT_PENALTY;
          reason = "study_time_short";
        }

        if (flameDelta !== 0 && userId) {
          const settingsId = userId;
          const settings = await db.appSettings.upsert({
            where: { id: settingsId },
            create: { id: settingsId, flamePoints: 0 },
            update: {},
          });

          // Ensure total never goes below 0
          const newTotal = Math.max(0, settings.flamePoints + flameDelta);
          await db.appSettings.update({
            where: { id: settingsId },
            data: { flamePoints: newTotal },
          });

          await db.flameTransaction.create({
            data: {
              amount: flameDelta,
              reason,
              courseId: session.courseId,
              userId,
            },
          });

          // Mark session as flame-awarded
          await db.studySession.update({
            where: { id: sessionId },
            data: { flameAwarded: true },
          });

          // Notify flame points earned/lost
          try {
            const { createNotification } = await import("@/lib/create-notification");
            if (flameDelta > 0) {
              await createNotification({ userId, type: "flame_points_earned", title: `🔥 +${flameDelta}`, message: `Good study session! +${flameDelta} flame points`, data: { points: flameDelta, reason: "study_time_good", courseId: session.courseId } });
            }
            // Check for tier upgrade
            const updatedSettings = await db.appSettings.findUnique({ where: { id: userId } });
            if (updatedSettings) {
              const prevType = getCurrentFlameType(updatedSettings.flamePoints - flameDelta);
              const newType = getCurrentFlameType(updatedSettings.flamePoints);
              if (prevType.id !== newType.id) {
                await createNotification({ userId, type: "flame_tier_up", title: `${newType.emoji} ${newType.name}`, message: `You reached ${updatedSettings.flamePoints} flame points!`, data: { points: updatedSettings.flamePoints, tierId: newType.id } });
              }
            }
          } catch { /* silent */ }

          return NextResponse.json({ success: true, durationSeconds, flameDelta, newTotal });
        } else if (flameDelta !== 0 && !userId) {
          // No userId — still mark as awarded to avoid re-checking
          await db.studySession.update({
            where: { id: sessionId },
            data: { flameAwarded: true },
          });
        }
      }

      return NextResponse.json({ success: true, durationSeconds });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Study session error:", error);
    return NextResponse.json({ error: "Failed to process study session" }, { status: 500 });
  }
}