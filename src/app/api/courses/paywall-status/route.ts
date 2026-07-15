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
    await migrateColumn("User", "freeCourseUsed", "BOOLEAN NOT NULL DEFAULT false");
  } catch { /* non-critical */ }
}

const GRACE_PERIOD_DAYS = 3;
/** 48 hours in milliseconds */
const EXPIRY_WARNING_MS = 48 * 60 * 60 * 1000;

type RenewalUrgency = "1month" | "2weeks" | "1week" | "3days" | "48hours" | "24hours" | "last24hours" | "none";

function computeRenewalUrgency(endDate: Date, plan: string): { urgency: RenewalUrgency; showReminder: boolean; timeRemainingMs?: number } {
  const now = new Date();
  const msRemaining = endDate.getTime() - now.getTime();
  const hoursRemaining = msRemaining / (1000 * 60 * 60);
  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);

  if (plan === "annual") {
    if (hoursRemaining <= 0) return { urgency: "none", showReminder: false };
    if (hoursRemaining <= 24) return { urgency: "last24hours", showReminder: true, timeRemainingMs: msRemaining };
    if (daysRemaining <= 1) return { urgency: "24hours", showReminder: true };
    if (daysRemaining <= 2) return { urgency: "48hours", showReminder: true };
    if (daysRemaining <= 3) return { urgency: "3days", showReminder: true };
    if (daysRemaining <= 7) return { urgency: "1week", showReminder: true };
    if (daysRemaining <= 14) return { urgency: "2weeks", showReminder: true };
    if (daysRemaining <= 30) return { urgency: "1month", showReminder: true };
    return { urgency: "none", showReminder: false };
  }

  // Monthly
  if (hoursRemaining <= 0) return { urgency: "none", showReminder: false };
  if (hoursRemaining <= 24) return { urgency: "last24hours", showReminder: true, timeRemainingMs: msRemaining };
  if (daysRemaining <= 1) return { urgency: "24hours", showReminder: true };
  if (daysRemaining <= 2) return { urgency: "48hours", showReminder: true };
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
  /** true when subscription expires within 48 hours */
  expiryWarning48h: boolean;
  isOfflineMode: boolean;
  showPaywall: boolean;
  paywallReason: string;
  firstName?: string;
  hasCardOnFile: boolean;
  requireCard: boolean;
  freeChapterLimit: number;
  /** Whether the user has already claimed their one-time free course */
  freeCourseUsed: boolean;
}

function defaultStatus(overrides: Partial<PaywallStatus> = {}): PaywallStatus {
  return {
    canStudy: true, canGenerate: true, canProgress: true,
    inTrial: false, trialCoursesGenerated: 0, trialCoursesMax: 1,
    hasSubscription: false, inGracePeriod: false,
    showRenewalReminder: false, renewalUrgency: "none",
    isOfflineMode: false, showPaywall: false, paywallReason: "no_user",
    hasCardOnFile: false, requireCard: false, freeChapterLimit: 9999,
    expiryWarning48h: false,
    ...overrides,
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureAllColumns();

    let userId: string | null = null;
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      userId = authHeader.substring(7);
    } else {
      const { searchParams } = new URL(request.url);
      userId = searchParams.get("userId");
    }

    // ── No user → full free access ──
    if (!userId) {
      return NextResponse.json<PaywallStatus>(defaultStatus());
    }

    // ── Fetch user data ──
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
        freeCourseUsed: true,
      },
    });

    // ── ACTIVE SUBSCRIPTION ──
    if (user && user.subscriptionStatus === "active") {
      const endDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
      const now = new Date();

      // Check if subscription has expired
      if (endDate && endDate <= now) {
        try {
          await db.user.update({
            where: { id: userId },
            data: { subscriptionStatus: "expired" },
          });
        } catch { /* fall through to grace period */ }
      } else {
        // Truly active
        let showRenewalReminder = false;
        let renewalDaysRemaining = 0;
        let renewalUrgency: RenewalUrgency = "none";
        let timeRemainingMs: number | undefined;
        let daysUntilExpiry: number | undefined;
        let expiryWarning48h = false;

        if (endDate) {
          const { urgency, showReminder, timeRemainingMs: trm } = computeRenewalUrgency(endDate, user.subscriptionPlan || "monthly");
          showRenewalReminder = showReminder;
          renewalUrgency = urgency;
          renewalDaysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          timeRemainingMs = trm;
          daysUntilExpiry = Math.max(0, renewalDaysRemaining);
          // 48h warning
          expiryWarning48h = (endDate.getTime() - now.getTime()) <= EXPIRY_WARNING_MS;
        }

        return NextResponse.json<PaywallStatus>({
          ...defaultStatus({
            canStudy: true, canGenerate: true, canProgress: true,
            hasSubscription: true,
            subscriptionPlan: user.subscriptionPlan,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionEndDate: user.subscriptionEndDate?.toISOString(),
            firstName: user.firstName || undefined,
            hasCardOnFile: true,
            showRenewalReminder,
            renewalDaysRemaining,
            renewalUrgency,
            timeRemainingMs,
            daysUntilExpiry,
            expiryWarning48h,
            paywallReason: "subscribed",
          }),
        });
      }
    }

    // ── GRACE PERIOD ──
    if (user && user.subscriptionEndDate &&
        (user.subscriptionStatus === "expired" || user.subscriptionStatus === "canceled" || user.subscriptionStatus === "past_due")) {
      const endDate = new Date(user.subscriptionEndDate);
      const now = new Date();
      const daysSinceEnd = (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24);
      const graceRemaining = Math.max(0, Math.ceil(GRACE_PERIOD_DAYS - daysSinceEnd));

      if (daysSinceEnd < GRACE_PERIOD_DAYS) {
        return NextResponse.json<PaywallStatus>(defaultStatus({
          canGenerate: false,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionEndDate: user.subscriptionEndDate?.toISOString(),
          inGracePeriod: true,
          graceDaysRemaining: graceRemaining,
          firstName: user.firstName || undefined,
          hasCardOnFile: !!user.hasCardOnFile,
          paywallReason: "grace_period",
          freeCourseUsed: user.freeCourseUsed,
        }));
      }

      // Grace expired
      return NextResponse.json<PaywallStatus>(defaultStatus({
        canStudy: false, canGenerate: false, canProgress: false,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate?.toISOString(),
        showPaywall: true,
        paywallReason: "grace_expired",
        firstName: user.firstName || undefined,
        hasCardOnFile: !!user.hasCardOnFile,
        freeCourseUsed: user.freeCourseUsed,
      }));
    }

    // ── FREE USER ──
    if (user) {
      // Single source of truth: freeCourseUsed boolean on the User model
      const freeUsed = !!user.freeCourseUsed;

      if (freeUsed) {
        // Free course already used → blocked from creating, but can study
        return NextResponse.json<PaywallStatus>(defaultStatus({
          canGenerate: false,
          showPaywall: true,
          paywallReason: "free_limit",
          firstName: user.firstName || undefined,
          hasCardOnFile: !!user.hasCardOnFile,
          freeCourseUsed: true,
        }));
      }

      // New user, free course not yet used → can generate
      return NextResponse.json<PaywallStatus>(defaultStatus({
        canGenerate: true,
        showPaywall: false,
        paywallReason: "free_available",
        firstName: user.firstName || undefined,
        hasCardOnFile: !!user.hasCardOnFile,
        freeCourseUsed: false,
      }));
    }

    // ── Fallback ──
    return NextResponse.json<PaywallStatus>(defaultStatus({ paywallReason: "no_user" }));
  } catch (error) {
    console.error("[paywall-status] Error:", error);
    return NextResponse.json<PaywallStatus>(defaultStatus({ paywallReason: "error" }));
  }
}