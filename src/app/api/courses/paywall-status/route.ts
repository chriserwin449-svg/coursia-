import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TRIAL_DURATION_DAYS = 7;
const TRIAL_MAX_COURSES = 3;
const GRACE_PERIOD_DAYS = 3;
const RENEWAL_REMINDER_DAYS = 3;

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
  subscriptionEndDate?: string;
  inGracePeriod: boolean;
  graceDaysRemaining?: number;
  showRenewalReminder: boolean;
  renewalDaysRemaining?: number;
  isOfflineMode: boolean;
  showPaywall: boolean;
  paywallReason: string;
}

export async function GET(request: NextRequest) {
  try {
    // ── 1. Get user ID from query or header ──
    let userId: string | null = null;
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      userId = authHeader.substring(7);
    } else {
      const { searchParams } = new URL(request.url);
      userId = searchParams.get("userId");
    }

    // ── 2. If no user, return default (free) ──
    if (!userId) {
      return NextResponse.json<PaywallStatus>({
        canStudy: true,
        canGenerate: true,
        canProgress: true,
        inTrial: false,
        trialCoursesGenerated: 0,
        trialCoursesMax: TRIAL_MAX_COURSES,
        hasSubscription: false,
        inGracePeriod: false,
        showRenewalReminder: false,
        isOfflineMode: false,
        showPaywall: false,
        paywallReason: "no_user",
      });
    }

    // ── 3. Fetch user data ──
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionEndDate: true,
        trialStartDate: true,
        email: true,
      },
    });

    // ── 4. ACTIVE SUBSCRIPTION ──
    if (user && user.subscriptionStatus === "active") {
      const endDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
      const now = new Date();

      // Check if subscription is ending soon (within RENEWAL_REMINDER_DAYS)
      let showRenewalReminder = false;
      let renewalDaysRemaining = 0;
      if (endDate && endDate > now) {
        const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilEnd <= RENEWAL_REMINDER_DAYS) {
          showRenewalReminder = true;
          renewalDaysRemaining = daysUntilEnd;
        }
      }

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
        subscriptionEndDate: user.subscriptionEndDate?.toISOString(),
        inGracePeriod: false,
        showRenewalReminder,
        renewalDaysRemaining,
        isOfflineMode: false,
        showPaywall: false,
        paywallReason: "subscribed",
      });
    }

    // ── 5. GRACE PERIOD (subscription expired/canceled but within GRACE_PERIOD_DAYS) ──
    if (user && user.subscriptionEndDate && 
        (user.subscriptionStatus === "expired" || user.subscriptionStatus === "canceled" || user.subscriptionStatus === "past_due")) {
      const endDate = new Date(user.subscriptionEndDate);
      const now = new Date();
      const daysSinceEnd = (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24);
      const graceRemaining = Math.max(0, Math.ceil(GRACE_PERIOD_DAYS - daysSinceEnd));

      if (daysSinceEnd < GRACE_PERIOD_DAYS) {
        return NextResponse.json<PaywallStatus>({
          canStudy: true,       // Can read existing courses
          canGenerate: false,    // Cannot create new courses
          canProgress: true,     // Can continue studying
          inTrial: false,
          trialCoursesGenerated: 0,
          trialCoursesMax: TRIAL_MAX_COURSES,
          hasSubscription: false,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionEndDate: user.subscriptionEndDate?.toISOString(),
          inGracePeriod: true,
          graceDaysRemaining: graceRemaining,
          showRenewalReminder: false,
          isOfflineMode: false,
          showPaywall: false,
          paywallReason: "grace_period",
        });
      }

      // Grace period expired — fully blocked
      return NextResponse.json<PaywallStatus>({
        canStudy: false,
        canGenerate: false,
        canProgress: false,
        inTrial: false,
        trialCoursesGenerated: 0,
        trialCoursesMax: TRIAL_MAX_COURSES,
        hasSubscription: false,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate?.toISOString(),
        inGracePeriod: false,
        showRenewalReminder: false,
        isOfflineMode: false,
        showPaywall: true,
        paywallReason: "grace_expired",
      });
    }

    // ── 6. TRIAL CHECK (user exists but no active/expired subscription) ──
    if (user) {
      // Count user's courses
      const courseCount = userId ? await db.course.count({ where: { userId } }) : 0;

      // No courses yet — free to start trial
      if (courseCount === 0) {
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
          showRenewalReminder: false,
          isOfflineMode: false,
          showPaywall: false,
          paywallReason: "no_courses",
        });
      }

      // Calculate trial from trialStartDate (or account creation if not set)
      const trialStart = user.trialStartDate ? new Date(user.trialStartDate) : (user.createdAt ? new Date(user.createdAt) : new Date());
      const now = new Date();
      const diffMs = now.getTime() - trialStart.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const daysRemaining = Math.max(0, Math.ceil(TRIAL_DURATION_DAYS - diffDays));

      // Trial still active
      if (diffDays < TRIAL_DURATION_DAYS) {
        const canGenerate = courseCount < TRIAL_MAX_COURSES;

        return NextResponse.json<PaywallStatus>({
          canStudy: true,
          canGenerate,
          canProgress: true,
          inTrial: true,
          trialDaysRemaining: daysRemaining,
          trialCoursesGenerated: courseCount,
          trialCoursesMax: TRIAL_MAX_COURSES,
          hasSubscription: false,
          inGracePeriod: false,
          showRenewalReminder: false,
          isOfflineMode: false,
          showPaywall: false,
          paywallReason: canGenerate ? "trial_active" : "trial_course_limit",
        });
      }

      // Trial expired — fully blocked
      return NextResponse.json<PaywallStatus>({
        canStudy: false,
        canGenerate: false,
        canProgress: false,
        inTrial: false,
        trialCoursesGenerated: courseCount,
        trialCoursesMax: TRIAL_MAX_COURSES,
        hasSubscription: false,
        inGracePeriod: false,
        showRenewalReminder: false,
        isOfflineMode: false,
        showPaywall: true,
        paywallReason: "trial_expired",
      });
    }

    // ── Fallback: no user found ──
    return NextResponse.json<PaywallStatus>({
      canStudy: true,
      canGenerate: true,
      canProgress: true,
      inTrial: false,
      trialCoursesGenerated: 0,
      trialCoursesMax: TRIAL_MAX_COURSES,
      hasSubscription: false,
      inGracePeriod: false,
      showRenewalReminder: false,
      isOfflineMode: false,
      showPaywall: false,
      paywallReason: "no_user",
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
      inGracePeriod: false,
      showRenewalReminder: false,
      isOfflineMode: false,
      showPaywall: false,
      paywallReason: "error",
    });
  }
}
