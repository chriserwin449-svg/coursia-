import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

async function migrateColumn(table: string, col: string, colDef: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `DO $$ BEGIN ALTER TABLE "${table}" ADD COLUMN "${col}" ${colDef}; EXCEPTION WHEN duplicate_column THEN null; END $$;`
    );
  } catch { /* non-critical */ }
}

async function ensureAllColumns(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.startsWith("file:")) return;
  try {
    await migrateColumn("User", "subscriptionPlan", "TEXT NOT NULL DEFAULT 'free'");
    await migrateColumn("User", "subscriptionStatus", "TEXT NOT NULL DEFAULT 'none'");
    await migrateColumn("User", "creemSubscriptionId", "TEXT");
    await migrateColumn("User", "creemCustomerId", "TEXT");
    await migrateColumn("User", "subscriptionStartDate", "TIMESTAMP(3)");
    await migrateColumn("User", "subscriptionEndDate", "TIMESTAMP(3)");
    await migrateColumn("User", "trialStartDate", "TIMESTAMP(3)");
    await migrateColumn("User", "hasCardOnFile", "BOOLEAN NOT NULL DEFAULT false");
  } catch { /* non-critical */ }
}

const FREE_COURSE_LIMIT = 1;
const FREE_CHAPTER_LIMIT = 1;
const GRACE_PERIOD_DAYS = 3;
const RENEWAL_NOTIFY_DAYS = 3; // Start showing notifications 3 days before expiry

type RenewalUrgency = "1month" | "2weeks" | "1week" | "3days" | "24hours" | "last24hours" | "none";

function computeRenewalUrgency(endDate: Date, plan: string): { urgency: RenewalUrgency; showReminder: boolean; timeRemainingMs?: number } {
  const now = new Date();
  const msRemaining = endDate.getTime() - now.getTime();
  const hoursRemaining = msRemaining / (1000 * 60 * 60);
  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);

  if (plan === "annual") {
    // Annual: 30 days, 14 days, 7 days, 3 days, 24 hours, last 24 hours
    if (hoursRemaining <= 0) return { urgency: "none", showReminder: false };
    if (hoursRemaining <= 24) return { urgency: "last24hours", showReminder: true, timeRemainingMs: msRemaining };
    if (daysRemaining <= 1) return { urgency: "24hours", showReminder: true };
    if (daysRemaining <= 3) return { urgency: "3days", showReminder: true };
    if (daysRemaining <= 7) return { urgency: "1week", showReminder: true };
    if (daysRemaining <= 14) return { urgency: "2weeks", showReminder: true };
    if (daysRemaining <= 30) return { urgency: "1month", showReminder: true };
    return { urgency: "none", showReminder: false };
  }

  // Monthly: 7 days, 3 days, 24 hours, last 24 hours
  if (hoursRemaining <= 0) return { urgency: "none", showReminder: false };
  if (hoursRemaining <= 24) return { urgency: "last24hours", showReminder: true, timeRemainingMs: msRemaining };
  if (daysRemaining <= 1) return { urgency: "24hours", showReminder: true };
  if (daysRemaining <= 3) return { urgency: "3days", showReminder: true };
  if (daysRemaining <= 7) return { urgency: "1week", showReminder: true };
  return { urgency: "none", showReminder: false };
}

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
  renewalUrgency: RenewalUrgency;
  timeRemainingMs?: number;
  daysUntilExpiry?: number;
  isOfflineMode: boolean;
  showPaywall: boolean;
  paywallReason: string;
  firstName?: string;
  hasCardOnFile: boolean;
  requireCard: boolean;
  freeChapterLimit: number;
}

export async function GET(request: NextRequest) {
  try {
    // Auto-migrate schema columns if needed (PostgreSQL only)
    await ensureAllColumns();

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
        trialCoursesMax: FREE_COURSE_LIMIT,
        hasSubscription: false,
        inGracePeriod: false,
        showRenewalReminder: false,
        renewalUrgency: "none",
        isOfflineMode: false,
        hasCardOnFile: false,
        requireCard: false,
        showPaywall: false,
        paywallReason: "no_user",
        freeChapterLimit: FREE_CHAPTER_LIMIT,
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
        createdAt: true,
        email: true,
        firstName: true,
        hasCardOnFile: true,
      },
    });

    // ── 4. ACTIVE SUBSCRIPTION ──
    if (user && user.subscriptionStatus === "active") {
      const endDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
      const now = new Date();

      // ── 4a. Check if subscription has expired (end date passed) ──
      if (endDate && endDate <= now) {
        // Auto-expire the subscription in the database
        try {
          await db.user.update({
            where: { id: userId },
            data: { subscriptionStatus: "expired" },
          });
        } catch {
          // If update fails, continue with grace period logic using in-memory status
        }
        // Fall through to grace period check below
      } else {
        // ── 4b. Subscription is truly active ──
        let showRenewalReminder = false;
        let renewalDaysRemaining = 0;
        let renewalUrgency: RenewalUrgency = "none";
        let timeRemainingMs: number | undefined;
        let daysUntilExpiry: number | undefined;

        if (endDate) {
          const { urgency, showReminder, timeRemainingMs: trm } = computeRenewalUrgency(endDate, user.subscriptionPlan || "monthly");
          showRenewalReminder = showReminder;
          renewalUrgency = urgency;
          renewalDaysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          timeRemainingMs = trm;
          daysUntilExpiry = Math.max(0, renewalDaysRemaining);
        }

        return NextResponse.json<PaywallStatus>({
          canStudy: true,
          canGenerate: true,
          canProgress: true,
          inTrial: false,
          trialCoursesGenerated: 0,
          trialCoursesMax: FREE_COURSE_LIMIT,
          hasSubscription: true,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionEndDate: user.subscriptionEndDate?.toISOString(),
          inGracePeriod: false,
          showRenewalReminder,
          renewalDaysRemaining,
          renewalUrgency,
          timeRemainingMs,
          daysUntilExpiry,
          isOfflineMode: false,
          showPaywall: false,
          paywallReason: "subscribed",
          firstName: user.firstName || undefined,
          hasCardOnFile: true,
          requireCard: false,
          freeChapterLimit: FREE_CHAPTER_LIMIT,
        });
      }
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
          canStudy: true,       // Can read existing courses during grace period
          canGenerate: false,    // Cannot create new courses
          canProgress: true,     // Can continue studying
          inTrial: false,
          trialCoursesGenerated: 0,
          trialCoursesMax: FREE_COURSE_LIMIT,
          hasSubscription: false,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionEndDate: user.subscriptionEndDate?.toISOString(),
          inGracePeriod: true,
          graceDaysRemaining: graceRemaining,
          showRenewalReminder: false,
          renewalUrgency: "none",
          isOfflineMode: false,
          showPaywall: false,
          paywallReason: "grace_period",
          firstName: user.firstName || undefined,
          hasCardOnFile: !!user.hasCardOnFile,
          requireCard: false,
          freeChapterLimit: FREE_CHAPTER_LIMIT,
        });
      }

      // Grace period expired — fully blocked
      return NextResponse.json<PaywallStatus>({
        canStudy: false,
        canGenerate: false,
        canProgress: false,
        inTrial: false,
        trialCoursesGenerated: 0,
        trialCoursesMax: FREE_COURSE_LIMIT,
        hasSubscription: false,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate?.toISOString(),
        inGracePeriod: false,
        graceDaysRemaining: 0,
        showRenewalReminder: false,
        renewalUrgency: "none",
        isOfflineMode: false,
        showPaywall: true,
        paywallReason: "grace_expired",
        firstName: user.firstName || undefined,
        hasCardOnFile: !!user.hasCardOnFile,
        requireCard: false,
        freeChapterLimit: FREE_CHAPTER_LIMIT,
      });
    }

    // ── 6. FREE PREVIEW CHECK (user exists but no active subscription) ──
    if (user) {
      const courseCount = userId ? await db.course.count({ where: { userId } }) : 0;

      // No courses yet — free to create first course
      if (courseCount === 0) {
        return NextResponse.json<PaywallStatus>({
          canStudy: true,
          canGenerate: true,
          canProgress: true,
          inTrial: false,
          trialDaysRemaining: 0,
          trialCoursesGenerated: 0,
          trialCoursesMax: FREE_COURSE_LIMIT,
          hasSubscription: false,
          inGracePeriod: false,
          showRenewalReminder: false,
          renewalUrgency: "none",
          isOfflineMode: false,
          showPaywall: false,
          paywallReason: "no_courses",
          firstName: user.firstName || undefined,
          hasCardOnFile: !!user.hasCardOnFile,
          requireCard: false,
          freeChapterLimit: FREE_CHAPTER_LIMIT,
        });
      }

      // Already used free course — blocked from creating more
      const canGenerate = courseCount < FREE_COURSE_LIMIT;
      return NextResponse.json<PaywallStatus>({
        canStudy: true, // can still read existing free course chapter 1
        canGenerate,
        canProgress: false,
        inTrial: false,
        trialDaysRemaining: 0,
        trialCoursesGenerated: courseCount,
        trialCoursesMax: FREE_COURSE_LIMIT,
        hasSubscription: false,
        inGracePeriod: false,
        showRenewalReminder: false,
        renewalUrgency: "none",
        isOfflineMode: false,
        showPaywall: !canGenerate,
        paywallReason: canGenerate ? "free_active" : "free_limit",
        firstName: user.firstName || undefined,
        hasCardOnFile: !!user.hasCardOnFile,
        requireCard: false,
        freeChapterLimit: FREE_CHAPTER_LIMIT,
      });
    }

    // ── Fallback: no user found ──
    return NextResponse.json<PaywallStatus>({
      canStudy: true,
      canGenerate: true,
      canProgress: true,
      inTrial: false,
      trialCoursesGenerated: 0,
      trialCoursesMax: FREE_COURSE_LIMIT,
      hasSubscription: false,
      inGracePeriod: false,
      showRenewalReminder: false,
      renewalUrgency: "none",
      isOfflineMode: false,
      showPaywall: false,
      paywallReason: "no_user",
      hasCardOnFile: false,
      requireCard: false,
      freeChapterLimit: FREE_CHAPTER_LIMIT,
    });
  } catch (error) {
    console.error("[paywall-status] Error:", error);
    return NextResponse.json<PaywallStatus>({
      canStudy: true,
      canGenerate: true,
      canProgress: true,
      inTrial: false,
      trialCoursesGenerated: 0,
      trialCoursesMax: FREE_COURSE_LIMIT,
      hasSubscription: false,
      inGracePeriod: false,
      showRenewalReminder: false,
      renewalUrgency: "none",
      isOfflineMode: false,
      showPaywall: false,
      paywallReason: "error",
      hasCardOnFile: false,
      requireCard: false,
      freeChapterLimit: FREE_CHAPTER_LIMIT,
    });
  }
}
