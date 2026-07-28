import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPayPalConfig, getPayPalMode } from "@/lib/paypal";

// ─── Manage subscription endpoint ────────────────────────────────────────
// GET /api/subscription/manage?userId=xxx
// Returns the PayPal subscription management URL for the user's active subscription.
// PayPal doesn't have a direct API endpoint for this, so we construct
// the known management URLs subscribers can use to cancel/change their plan.

export async function GET(request: NextRequest) {
  try {
    // 1. Validate PayPal configuration
    try {
      getPayPalConfig();
    } catch {
      return NextResponse.json(
        { error: "PayPal is not configured", code: "PAYPAL_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    // 2. Get userId
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!userId || userId.length < 5) {
      return NextResponse.json(
        { error: "Valid userId is required" },
        { status: 400 }
      );
    }

    // 3. Fetch user from DB
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionEndDate: true,
        subscriptionStartDate: true,
        creemSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 4. Check if user has a subscription
    if (!user.creemSubscriptionId) {
      return NextResponse.json(
        {
          error: "No active subscription found",
          code: "NO_SUBSCRIPTION",
          hasSubscription: false,
        },
        { status: 200 }
      );
    }

    // 5. Extract PayPal subscription ID
    const rawSubId = user.creemSubscriptionId;
    const paypalSubscriptionId = rawSubId.startsWith("paypal_")
      ? rawSubId.slice(7)
      : rawSubId;

    // 6. Construct management URLs
    const mode = getPayPalMode();
    const isSandbox = mode === "sandbox";

    // PayPal provides these management URLs for subscribers:
    // - Autopay management: https://www.paypal.com/myaccount/autopay/
    // - Specific subscription: https://www.paypal.com/billing/subscriptions/{id}
    const baseUrl = isSandbox
      ? "https://www.sandbox.paypal.com"
      : "https://www.paypal.com";

    const manageUrl = `${baseUrl}/billing/subscriptions/${paypalSubscriptionId}`;
    const autopayUrl = `${baseUrl}/myaccount/autopay/`;

    // 7. Return management data
    return NextResponse.json({
      hasSubscription: true,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionEndDate: user.subscriptionEndDate?.toISOString() || null,
      subscriptionStartDate: user.subscriptionStartDate?.toISOString() || null,
      paypalSubscriptionId,
      manageUrl,
      autopayUrl,
      // Prefer the specific subscription URL for direct management
      redirectUrl: manageUrl,
    });
  } catch (error) {
    console.error("[subscription/manage] Error:", error);
    return NextResponse.json(
      { error: "Failed to get management URL", code: "MANAGE_ERROR" },
      { status: 500 }
    );
  }
}
