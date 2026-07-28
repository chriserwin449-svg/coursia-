import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPayPalConfig, getSubscriptionDetails } from "@/lib/paypal";

// ─── PayPal subscription sync endpoint ─────────────────────────────────
// POST /api/subscription/sync
// Takes userId, fetches PayPal subscription details, compares with DB,
// updates DB if there's a mismatch. Ensures DB always reflects the real PayPal state.

export async function POST(request: NextRequest) {
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

    // 2. Parse body
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { userId } = body;

    if (!userId || typeof userId !== "string" || userId.length < 5) {
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
        email: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        creemSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 4. Extract PayPal subscription ID from creemSubscriptionId
    const rawSubId = user.creemSubscriptionId;
    if (!rawSubId) {
      return NextResponse.json(
        {
          synced: false,
          paypalStatus: null,
          dbStatus: user.subscriptionStatus,
          plan: user.subscriptionPlan,
          endDate: user.subscriptionEndDate?.toISOString() || null,
          reason: "NO_PAYPAL_SUBSCRIPTION_ID",
          message: "No PayPal subscription ID found on user record",
        },
        { status: 200 }
      );
    }

    // Strip the "paypal_" prefix if present
    const paypalSubscriptionId = rawSubId.startsWith("paypal_")
      ? rawSubId.slice(7)
      : rawSubId;

    // 5. Fetch subscription details from PayPal
    let paypalDetails;
    try {
      paypalDetails = await getSubscriptionDetails(paypalSubscriptionId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[subscription/sync] PayPal fetch failed for ${paypalSubscriptionId}:`, errMsg);
      return NextResponse.json(
        {
          synced: false,
          paypalStatus: null,
          dbStatus: user.subscriptionStatus,
          plan: user.subscriptionPlan,
          endDate: user.subscriptionEndDate?.toISOString() || null,
          reason: "PAYPAL_FETCH_ERROR",
          message: `Could not fetch subscription from PayPal: ${errMsg}`,
        },
        { status: 200 }
      );
    }

    // 6. Map PayPal status to our DB status
    const paypalStatus = paypalDetails.status.toUpperCase();
    const statusMap: Record<string, string> = {
      "ACTIVE": "active",
      "APPROVAL_PENDING": "pending",
      "APPROVED": "pending",
      "SUSPENDED": "suspended",
      "CANCELLED": "canceled",
      "EXPIRED": "expired",
      "PAUSED": "suspended",
    };

    const mappedStatus = statusMap[paypalStatus] || paypalStatus.toLowerCase();

    // 7. Check for mismatch and update if needed
    let synced = false;
    const mismatch = user.subscriptionStatus !== mappedStatus;

    if (mismatch) {
      console.log(`[subscription/sync] Status mismatch for user ${userId.slice(0, 8)}...: DB=${user.subscriptionStatus}, PayPal=${paypalStatus} → mapped=${mappedStatus}`);

      // Build update data
      const updateData: Record<string, unknown> = {
        subscriptionStatus: mappedStatus,
      };

      // If active, update end date from PayPal's next billing time
      if (mappedStatus === "active" && paypalDetails.nextBillingTime) {
        updateData.subscriptionEndDate = new Date(paypalDetails.nextBillingTime);
      }

      // If active and we have start time, update it
      if (mappedStatus === "active" && paypalDetails.startTime) {
        updateData.subscriptionStartDate = new Date(paypalDetails.startTime);
      }

      // Determine plan from PayPal custom_id if we don't have one
      if (!user.subscriptionPlan || user.subscriptionPlan === "free") {
        try {
          if (paypalDetails.customId) {
            const customData = JSON.parse(paypalDetails.customId);
            if (customData.plan) {
              updateData.subscriptionPlan = customData.plan;
            }
          }
        } catch { /* ignore parse error */ }
      }

      try {
        await db.user.update({
          where: { id: userId },
          data: updateData,
        });
        synced = true;
        console.log(`[subscription/sync] DB updated for user ${userId.slice(0, 8)}...: ${user.subscriptionStatus} → ${mappedStatus}`);
      } catch (dbErr) {
        console.error(`[subscription/sync] DB update failed for user ${userId.slice(0, 8)}...:`, dbErr);
        return NextResponse.json(
          {
            synced: false,
            paypalStatus,
            dbStatus: user.subscriptionStatus,
            plan: user.subscriptionPlan,
            endDate: user.subscriptionEndDate?.toISOString() || null,
            reason: "DB_UPDATE_ERROR",
            message: "PayPal status differs from DB but update failed",
          },
          { status: 200 }
        );
      }
    }

    // 8. Return sync result
    return NextResponse.json({
      synced,
      paypalStatus,
      dbStatus: mismatch ? user.subscriptionStatus : mappedStatus,
      updatedDbStatus: mismatch ? mappedStatus : undefined,
      plan: user.subscriptionPlan || "free",
      endDate: user.subscriptionEndDate?.toISOString() || null,
      nextBillingTime: paypalDetails.nextBillingTime || null,
      startTime: paypalDetails.startTime || null,
      reason: mismatch ? "STATUS_MISMATCH_CORRECTED" : "STATUS_ALIGNED",
    });
  } catch (error) {
    console.error("[subscription/sync] Unhandled error:", error);
    return NextResponse.json(
      { error: "Sync failed", code: "SYNC_ERROR" },
      { status: 500 }
    );
  }
}
