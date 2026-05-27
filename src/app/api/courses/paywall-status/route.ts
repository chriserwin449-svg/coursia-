import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const TRIAL_DURATION_DAYS = 3;
const TRIAL_MAX_COURSES = 3;
const GRACE_PERIOD_DAYS = 7;

interface PaywallStatus {
  canStudy: boolean;
  canGenerate: boolean;
  canProgress: boolean;
  inTrial: boolean;
  trialDaysRemaining?: number;
  trialCoursesGenerated: number;
  trialCoursesMax: number;
  hasSubscription: boolean;
  subscriptionExpiryDate?: string;
  inGracePeriod: boolean;
  graceDaysRemaining?: number;
  isOfflineMode: boolean;
  showPaywall: boolean;
  paywallReason: string;
}

export async function GET() {
  try {
    // ── 1. Fetch AppSettings ──
    const settings = await db.appSettings.findUnique({ where: { id: "main" } });

    const isSubscribed = settings?.hasSubscription === true;
    const updatedAt = settings?.updatedAt ?? null;

    // ── 2. SUBSCRIBED (full access) ──
    if (isSubscribed) {
      return NextResponse.json<PaywallStatus>({
        canStudy: true,
        canGenerate: true,
        canProgress: true,
        inTrial: false,
        trialCoursesGenerated: 0,
        trialCoursesMax: TRIAL_MAX_COURSES,
        hasSubscription: true,
        inGracePeriod: false,
        isOfflineMode: false,
        showPaywall: false,
        paywallReason: "subscribed",
      });
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
        inGracePeriod: false,
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
        inGracePeriod: false,
        isOfflineMode: false,
        showPaywall: !canGenerate,
        paywallReason: canGenerate ? "trial_active" : "trial_active",
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
      inGracePeriod: false,
      isOfflineMode: false,
      showPaywall: true,
      paywallReason: "trial_expired",
    });
  } catch (error) {
    console.error("[paywall-status] Error:", error);
    // On error, be permissive — don't block users due to server errors
    return NextResponse.json<PaywallStatus>({
      canStudy: true,
      canGenerate: true,
      canProgress: true,
      inTrial: false,
      trialCoursesGenerated: 0,
      trialCoursesMax: TRIAL_MAX_COURSES,
      hasSubscription: false,
      inGracePeriod: false,
      isOfflineMode: false,
      showPaywall: false,
      paywallReason: "no_courses",
    });
  }
}
