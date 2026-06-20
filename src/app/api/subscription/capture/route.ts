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

    const { orderId, userId } = body as Record<string, unknown>;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "Order ID required" },
        { status: 400, headers: securityHeaders() }
      );
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Capture the PayPal order
    const result = await capturePayPalOrder(orderId);

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
      plan = paymentReq?.plan || "annual";
    }

    const targetUserId = result.customData?.userId || userId;

    // Activate subscription (idempotent — won't double-activate)
    const activationResult = await activateSubscription(targetUserId, plan, orderId);

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
    return NextResponse.json(
      { error: "Payment capture failed" },
      { status: 500, headers: securityHeaders() }
    );
  }
}
