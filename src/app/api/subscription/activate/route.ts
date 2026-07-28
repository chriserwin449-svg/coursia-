import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPayPalConfig, getSubscriptionDetails } from "@/lib/paypal";

// ─── Security headers ────────────────────────────────────────────────────
function securityHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}

// ─── Input validation ──────────────────────────────────────────────────────
function isValidUserId(userId: string): boolean {
  const idRegex = /^[a-z0-9-]+$/;
  return userId.length > 5 && userId.length < 50 && idRegex.test(userId);
}

// ─── POST handler: Activate subscription after PayPal redirect ──────────
// Called by the frontend when the user returns from PayPal with a
// subscription_id in the URL. We fetch the live subscription details from
// PayPal to confirm it was approved, then activate the user's plan.
//
// This is the FAST path — the webhook may take a few seconds to arrive,
// so we don't make the user wait. Both this endpoint and the webhook are
// idempotent: whichever arrives second is a no-op.
export async function POST(request: NextRequest) {
  try {
    // 0. Check PayPal configuration
    try {
      getPayPalConfig();
    } catch {
      return NextResponse.json(
        { error: "PayPal is not configured yet.", code: "PAYPAL_NOT_CONFIGURED" },
        { status: 503, headers: securityHeaders() }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: securityHeaders() }
      );
    }

    const { subscriptionId, userId, requestId } = body as Record<string, unknown>;

    if (!userId || typeof userId !== "string" || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // ─── Lookup mode: subscriptionId starts with "lookup:" ───
    // This means PayPal didn't return a subscription_id in the URL.
    // We look up the PaymentRequest record by requestId to find the
    // PayPal subscription ID stored as txRef during checkout.
    let resolvedSubscriptionId = subscriptionId as string;
    if (typeof subscriptionId === "string" && subscriptionId.startsWith("lookup:")) {
      const lookupReqId = subscriptionId.replace("lookup:", "");
      console.log("[activate] Lookup mode — searching PaymentRequest:", lookupReqId.slice(0, 12) + "...");
      try {
        const paymentReq = await db.paymentRequest.findUnique({
          where: { id: lookupReqId },
          select: { txRef: true, plan: true, userId: true },
        });
        if (paymentReq?.txRef && paymentReq.txRef.startsWith("I-")) {
          resolvedSubscriptionId = paymentReq.txRef;
          console.log("[activate] Found subscription ID:", resolvedSubscriptionId.slice(0, 12) + "...");
        } else {
          // No subscription found — maybe webhook already handled it
          // Check if user already has an active subscription
          const existingUser = await db.user.findUnique({
            where: { id: userId as string },
            select: { subscriptionStatus: true, subscriptionPlan: true },
          });
          if (existingUser?.subscriptionStatus === "active") {
            console.log("[activate] User already has active subscription — confirming");
            return NextResponse.json({
              success: true,
              alreadyActive: true,
              plan: existingUser.subscriptionPlan,
              status: "ACTIVE",
            }, { headers: securityHeaders() });
          }
          return NextResponse.json(
            { error: "Subscription ID not found in database. The webhook will activate it shortly.", code: "LOOKUP_FAILED" },
            { status: 404, headers: securityHeaders() }
          );
        }
      } catch (err) {
        console.error("[activate] Lookup error:", err);
      }
    }

    if (!resolvedSubscriptionId || resolvedSubscriptionId.length < 5) {
      return NextResponse.json(
        { error: "Subscription ID required" },
        { status: 400, headers: securityHeaders() }
      );
    }

    console.log("[activate] Verifying subscription:", {
      subscriptionId: resolvedSubscriptionId.slice(0, 12) + "...",
      userId: (userId as string).slice(0, 8) + "...",
      requestId: typeof requestId === "string" ? (requestId as string).slice(0, 12) + "..." : "none",
    });

    // 1. Fetch live subscription details from PayPal
    let details;
    try {
      details = await getSubscriptionDetails(resolvedSubscriptionId);
    } catch (error) {
      console.error("[activate] Failed to fetch subscription details:", error);
      return NextResponse.json(
        { error: "Could not verify subscription with PayPal. The webhook will activate it shortly.", code: "PAYPAL_FETCH_FAILED" },
        { status: 502, headers: securityHeaders() }
      );
    }

    console.log("[activate] PayPal subscription status:", details.status, "for sub:", resolvedSubscriptionId.slice(0, 12) + "...");

    // 2. Determine plan from custom_id (preferred) or from payment request
    let plan: string | undefined;
    let targetUserId = userId;

    if (details.customId) {
      try {
        const meta = JSON.parse(details.customId) as { userId?: string; plan?: string };
        plan = meta.plan;
        if (meta.userId) targetUserId = meta.userId;
      } catch {
        // ignore parse errors
      }
    }

    // Fallback: look up payment request by subscription ID or requestId
    if (!plan) {
      if (typeof requestId === "string") {
        const paymentReq = await db.paymentRequest.findUnique({ where: { id: requestId } });
        if (paymentReq) {
          plan = paymentReq.plan;
          targetUserId = paymentReq.userId;
        }
      } else {
        const paymentReq = await db.paymentRequest.findFirst({
          where: { txRef: resolvedSubscriptionId },
        });
        if (paymentReq) {
          plan = paymentReq.plan;
          targetUserId = paymentReq.userId;
        }
      }
    }

    if (!plan || (plan !== "monthly" && plan !== "annual")) {
      return NextResponse.json(
        { error: "Could not determine subscription plan", code: "PLAN_NOT_FOUND" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 3. Accept both APPROVAL_PENDING (user just approved, PayPal is processing)
    // and ACTIVE states. We activate immediately for fast UX.
    const acceptableStatuses = ["APPROVAL_PENDING", "ACTIVE", "APPROVED"];
    if (!acceptableStatuses.includes(details.status)) {
      console.warn("[activate] Subscription not in acceptable state:", details.status);
      return NextResponse.json(
        {
          success: false,
          status: details.status,
          error: `Subscription is ${details.status}. Please contact support if you believe this is an error.`,
        },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 4. Idempotency: skip if user already has this exact subscription
    const existingUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        subscriptionStatus: true,
        creemSubscriptionId: true,
      },
    });

    const sameSubscription = existingUser?.creemSubscriptionId === `paypal_${resolvedSubscriptionId}`;
    if (existingUser?.subscriptionStatus === "active" && sameSubscription) {
      console.log("[activate] Already active with same subscription — skipping");
      return NextResponse.json(
        {
          success: true,
          alreadyActive: true,
          plan,
          status: details.status,
          nextBillingTime: details.nextBillingTime,
        },
        { headers: securityHeaders() }
      );
    }

    // 5. Activate subscription in DB
    const now = new Date();
    let endDate: Date;
    if (details.nextBillingTime) {
      endDate = new Date(details.nextBillingTime);
      if (isNaN(endDate.getTime())) {
        const duration = plan === "annual" ? 365 : 30;
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() + duration);
      }
    } else {
      const duration = plan === "annual" ? 365 : 30;
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + duration);
    }

    await db.user.update({
      where: { id: targetUserId },
      data: {
        subscriptionPlan: plan,
        subscriptionStatus: "active",
        subscriptionStartDate: now,
        subscriptionEndDate: endDate,
        creemSubscriptionId: `paypal_${resolvedSubscriptionId}`,
        hasCardOnFile: true,
      },
    });

    // Mark payment request as approved
    await db.paymentRequest.updateMany({
      where: { userId: targetUserId, plan, status: "pending" },
      data: {
        status: "approved",
        adminNote: `Activated via /activate endpoint. PayPal sub: ${resolvedSubscriptionId}`,
        txRef: resolvedSubscriptionId,
      },
    });

    console.log("[activate] ✅ Subscription activated:", {
      userId: targetUserId.slice(0, 8) + "...",
      plan,
      subscriptionId: resolvedSubscriptionId.slice(0, 12) + "...",
      endDate: endDate.toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        alreadyActive: false,
        plan,
        status: details.status,
        nextBillingTime: details.nextBillingTime,
        subscriptionEndDate: endDate.toISOString(),
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error("[activate] Unhandled error:", error);
    const err = error as Error & { code?: string };
    return NextResponse.json(
      { error: "Subscription activation failed", details: err.message, code: err.code || "ACTIVATE_UNKNOWN" },
      { status: 500, headers: securityHeaders() }
    );
  }
}
