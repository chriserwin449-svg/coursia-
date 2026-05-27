import { NextResponse } from "next/server";

/**
 * GET /api/subscription/status
 *
 * Proxy endpoint that forwards to /api/courses/paywall-status and
 * returns a simplified subscription-related payload for the client.
 */
export async function GET() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/courses/paywall-status`);

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
      inTrial: data.inTrial,
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
