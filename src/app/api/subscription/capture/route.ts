import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { capturePayPalOrder, getPayPalConfig } from "@/lib/paypal";

// ─── Security headers ────────────────────────────────────────────────────
function securityHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}

// ─── Activate subscription helper (idempotent) ─────────────────────────────
async function activateSubscription(
  userId: string,
  plan: string,
  orderId: string
): Promise<{ activated: boolean; wasAlreadyActive: boolean }> {
  // Card verification: just mark card on file, no subscription
  if (plan === "card_verify") {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { hasCardOnFile: true },
    });

    if (user?.hasCardOnFile) {
      console.log(`[capture] Card already on file for user ${userId.slice(0, 8)}... — skipping`);
      return { activated: false, wasAlreadyActive: true };
    }

    await db.user.update({
      where: { id: userId },
      data: { hasCardOnFile: true },
    });

    // Mark payment request as approved
    await db.paymentRequest.updateMany({
      where: { userId, plan: "card_verify", status: "pending" },
      data: {
        status: "approved",
        adminNote: `Card verified via PayPal: ${orderId}`,
        txRef: orderId,
      },
    });

    console.log(`[capture] Card verified for user ${userId.slice(0, 8)}...`);
    return { activated: true, wasAlreadyActive: false };
  }

  // Check if user already has an active subscription (idempotency)
  const existingUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      subscriptionPlan: true,
      creemSubscriptionId: true,
    },
  });

  if (existingUser?.subscriptionStatus === "active") {
    console.log(`[capture] User ${userId.slice(0, 8)}... already has active subscription (${existingUser.subscriptionPlan}) — skipping activation`);
    return { activated: false, wasAlreadyActive: true };
  }

  // Regular subscription activation
  const now = new Date();
  const duration = plan === "annual" ? 365 : 30;
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + duration);

  await db.user.update({
    where: { id: userId },
    data: {
      subscriptionPlan: plan,
      subscriptionStatus: "active",
      subscriptionStartDate: now,
      subscriptionEndDate: endDate,
      creemSubscriptionId: `paypal_${orderId}`,
      hasCardOnFile: true,
    },
  });

  // Mark payment request as approved
  await db.paymentRequest.updateMany({
    where: {
      userId,
      plan,
      status: "pending",
    },
    data: {
      status: "approved",
      adminNote: `Auto-approved via PayPal capture: ${orderId}`,
      txRef: orderId,
    },
  });

  console.log(`[capture] Subscription activated for user ${userId.slice(0, 8)}... plan=${plan}, ends=${endDate.toISOString()}`);
  return { activated: true, wasAlreadyActive: false };
}

// ─── POST handler: Capture a PayPal order ───────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // 0. Check PayPal configuration
    try {
      getPayPalConfig();
    } catch {
      return NextResponse.json(
        { error: "PayPal is not configured yet. Payment capture is unavailable.", code: "PAYPAL_NOT_CONFIGURED" },
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

    const { orderId, userId, requestId } = body as Record<string, unknown>;

    // Support two modes:
    // 1. Direct orderId — used by webhook/advanced flows
    // 2. requestId — used by redirect flow (looks up payment request to get PayPal orderId)
    let paypalOrderId = orderId as string | undefined;
    let targetUserId = userId as string | undefined;

    if (requestId && typeof requestId === "string") {
      // Look up the payment request to get the PayPal order ID
      const paymentReq = await db.paymentRequest.findUnique({
        where: { id: requestId },
      });
      if (!paymentReq) {
        return NextResponse.json(
          { error: "Payment request not found" },
          { status: 404, headers: securityHeaders() }
        );
      }
      paypalOrderId = paymentReq.txRef;
      targetUserId = paymentReq.userId;

      if (!paypalOrderId) {
        console.error("[capture] Payment request has no PayPal order ID (txRef)");
        return NextResponse.json(
          { error: "Payment not yet associated with PayPal order" },
          { status: 400, headers: securityHeaders() }
        );
      }

      console.log("[capture] Resolved from requestId:", { requestId, paypalOrderId: paypalOrderId.slice(0, 12) + "...", userId: targetUserId?.slice(0, 8) + "..." });
    }

    if (!paypalOrderId || typeof paypalOrderId !== "string") {
      return NextResponse.json(
        { error: "Order ID required" },
        { status: 400, headers: securityHeaders() }
      );
    }

    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Capture the PayPal order
    const result = await capturePayPalOrder(paypalOrderId);

    if (result.status !== "COMPLETED") {
      console.warn("[capture] Order not completed:", result.status);
      return NextResponse.json(
        { error: `Payment not completed: ${result.status}` },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Get the plan from custom data or from the payment request
    let plan = result.customData?.plan;
    if (!plan) {
      // Look up the payment request by PayPal order ID
      const paymentReq = await db.paymentRequest.findFirst({
        where: { txRef: orderId },
      });
      plan = paymentReq?.plan || "monthly";
    }

    // Prefer custom data userId, fallback to resolved userId
    const finalUserId = result.customData?.userId || targetUserId;

    // Activate subscription (idempotent — won't double-activate)
    const activationResult = await activateSubscription(finalUserId, plan, paypalOrderId);

    console.log("[capture] PayPal order captured:", {
      orderId: result.orderId,
      userId: targetUserId.slice(0, 8) + "...",
      plan,
      amount: result.amount,
      currency: result.currency,
      payerEmail: result.payerEmail,
      activated: activationResult.activated,
      wasAlreadyActive: activationResult.wasAlreadyActive,
    });

    return NextResponse.json(
      {
        success: true,
        orderId: result.orderId,
        status: result.status,
        plan,
        alreadyActive: activationResult.wasAlreadyActive,
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error("[capture] Unhandled error:", error);

    // Classify capture errors for frontend
    const err = error as Error & { code?: string };
    const errorCode = err.code || "CAPTURE_UNKNOWN";
    const errMsg = err.message || "Unknown error";

    // If the order was already captured, return success with alreadyActive flag
    // This prevents blocking the user after a double-click or race condition
    if (errorCode === "PAYPAL_ALREADY_CAPTURED") {
      console.warn("[capture] Order already captured — this may be a double-click");
      return NextResponse.json(
        { success: true, orderId: "unknown", status: "COMPLETED", plan: "unknown", alreadyActive: true },
        { headers: securityHeaders() }
      );
    }

    // For order not found, check if subscription is already active (webhook may have handled it)
    if (errorCode === "PAYPAL_ORDER_NOT_FOUND") {
      const targetUserId = (error as Error & { userId?: string }).userId;
      if (targetUserId) {
        try {
          const user = await db.user.findUnique({
            where: { id: targetUserId },
            select: { subscriptionStatus: true, subscriptionPlan: true },
          });
          if (user?.subscriptionStatus === "active") {
            console.log("[capture] Order not found but user already has active subscription — treating as success");
            return NextResponse.json(
              { success: true, orderId: "unknown", status: "COMPLETED", plan: user.subscriptionPlan, alreadyActive: true },
              { headers: securityHeaders() }
            );
          }
        } catch { /* non-critical */ }
      }
    }

    return NextResponse.json(
      { error: "Payment capture failed", details: errMsg, code: errorCode },
      { status: 500, headers: securityHeaders() }
    );
  }
}
