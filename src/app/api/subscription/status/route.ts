import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/subscription/status
 *
 * Proxy endpoint that forwards to /api/courses/paywall-status and
 * returns a simplified subscription-related payload for the client.
 */
export async function GET(request: NextRequest) {
  try {
    // Pass userId from query or header to paywall-status
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || request.headers.get("Authorization")?.replace("Bearer ", "") || "";

    const url = new URL("/api/courses/paywall-status", request.url);
    if (userId) url.searchParams.set("userId", userId);

    const res = await fetch(url.toString());

    if (!res.ok) {
      console.error("[subscription/status] paywall-status returned", res.status);
      return NextResponse.json(
        { error: "Failed to fetch subscription status" },
        { status: 502 },
      );
    }

    const data = await res.json();

    return NextResponse.json({
      hasSubscription: data.hasSubscription,
      subscriptionPlan: data.subscriptionPlan,
      subscriptionStatus: data.subscriptionStatus,
      subscriptionEndDate: data.subscriptionEndDate,
      inTrial: data.inTrial,
      trialDaysRemaining: data.trialDaysRemaining,
      trialCoursesGenerated: data.trialCoursesGenerated,
      trialCoursesMax: data.trialCoursesMax,
      inGracePeriod: data.inGracePeriod,
      graceDaysRemaining: data.graceDaysRemaining,
      showRenewalReminder: data.showRenewalReminder,
      renewalDaysRemaining: data.renewalDaysRemaining,
      canStudy: data.canStudy,
      canGenerate: data.canGenerate,
      canProgress: data.canProgress,
      isOfflineMode: data.isOfflineMode,
      showPaywall: data.showPaywall,
      paywallReason: data.paywallReason,
    });
  } catch (error) {
    console.error("[subscription/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription status" },
      { status: 500 },
    );
  }
}
