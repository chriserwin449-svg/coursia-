import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TRIAL_DURATION_DAYS = 3;
const TRIAL_MAX_COURSES = 3;

interface PaywallStatus {
  canStudy: boolean;
  canGenerate: boolean;
  canProgress: boolean;
  inTrial: boolean;
  trialDaysRemaining?: number;
  trialCoursesGenerated: number;
  trialCoursesMax: number;
  hasSubscription: boolean;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  isOfflineMode: boolean;
  showPaywall: boolean;
  paywallReason: string;
}

export async function GET(request: NextRequest) {
  try {
    // ── 1. Try to get user ID from query or header ──
    let userId: string | null = null;
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      userId = authHeader.substring(7);
    } else {
      const { searchParams } = new URL(request.url);
      userId = searchParams.get("userId");
    }

    // ── 2. Check user-level subscription ──
    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionPlan: true,
          subscriptionStatus: true,
          email: true,
        },
      });

      if (user && user.subscriptionStatus === "active") {
        return NextResponse.json<PaywallStatus>({
          canStudy: true,
          canGenerate: true,
          canProgress: true,
          inTrial: false,
          trialCoursesGenerated: 0,
          trialCoursesMax: TRIAL_MAX_COURSES,
          hasSubscription: true,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionStatus: user.subscriptionStatus,
          isOfflineMode: false,
          showPaywall: false,
          paywallReason: "subscribed",
        });
      }
    }

    // ── 3. Count existing courses ──
    const courseCount = await db.course.count();
    const trialCoursesGenerated = courseCount;

    // ── 4. Find earliest course date ──
    const earliestCourse = await db.course.findFirst({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    // ── 5. NO COURSES (free, can generate) ──
    if (!earliestCourse) {
      return NextResponse.json<PaywallStatus>({
        canStudy: true,
        canGenerate: true,
        canProgress: true,
        inTrial: false,
        trialDaysRemaining: TRIAL_DURATION_DAYS,
        trialCoursesGenerated: 0,
        trialCoursesMax: TRIAL_MAX_COURSES,
        hasSubscription: false,
        isOfflineMode: false,
        showPaywall: false,
        paywallReason: "no_courses",
      });
    }

    // ── 6. Trial calculation ──
    const firstCourseDate = new Date(earliestCourse.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - firstCourseDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, Math.ceil(TRIAL_DURATION_DAYS - diffDays));

    // ── 7. TRIAL ACTIVE ──
    if (diffDays < TRIAL_DURATION_DAYS) {
      const canGenerate = trialCoursesGenerated < TRIAL_MAX_COURSES;

      return NextResponse.json<PaywallStatus>({
        canStudy: true,
        canGenerate,
        canProgress: true,
        inTrial: true,
        trialDaysRemaining: daysRemaining,
        trialCoursesGenerated,
        trialCoursesMax: TRIAL_MAX_COURSES,
        hasSubscription: false,
        isOfflineMode: false,
        showPaywall: false,
        paywallReason: canGenerate ? "trial_active" : "trial_course_limit",
      });
    }

    // ── 8. TRIAL EXPIRED (blocked) ──
    return NextResponse.json<PaywallStatus>({
      canStudy: false,
      canGenerate: false,
      canProgress: false,
      inTrial: false,
      trialCoursesGenerated,
      trialCoursesMax: TRIAL_MAX_COURSES,
      hasSubscription: false,
      isOfflineMode: false,
      showPaywall: true,
      paywallReason: "trial_expired",
    });
  } catch (error) {
    console.error("[paywall-status] Error:", error);
    return NextResponse.json<PaywallStatus>({
      canStudy: true,
      canGenerate: true,
      canProgress: true,
      inTrial: false,
      trialCoursesGenerated: 0,
      trialCoursesMax: TRIAL_MAX_COURSES,
      hasSubscription: false,
      isOfflineMode: false,
      showPaywall: false,
      paywallReason: "no_courses",
    });
  }
}
