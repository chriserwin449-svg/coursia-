import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/paypal";

// ─── Security headers ────────────────────────────────────────────────────
function securityHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

// ─── Activate subscription helper ─────────────────────────────────────────
async function activateSubscription(
  userId: string,
  plan: string,
  orderId: string,
  payerEmail?: string
): Promise<boolean> {
  try {
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
        adminNote: `Auto-approved via PayPal webhook: ${orderId}${payerEmail ? ` | payer: ${payerEmail}` : ""}`,
        txRef: orderId,
      },
    });

    console.log(`[webhook] Subscription activated via webhook for user ${userId.slice(0, 8)}..., plan=${plan}`);
    return true;
  } catch (error) {
    console.error("[webhook] Failed to activate subscription:", error);
    return false;
  }
}

// ─── POST handler: PayPal webhook ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    if (!body) {
      return NextResponse.json(
        { error: "Empty body" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 1. Verify webhook signature
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const isValid = await verifyWebhookSignature(body, headers);
    if (!isValid) {
      console.warn("[webhook] Invalid signature — ignoring");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 403, headers: securityHeaders() }
      );
    }

    // 2. Parse webhook event
    const event = JSON.parse(body) as {
      event_type: string;
      resource: {
        id: string;
        status?: string;
        custom_id?: string;
        purchase_units?: Array<{ custom_id?: string; reference_id?: string }>;
      };
      id: string;
    };

    console.log("[webhook] Received event:", event.event_type, "for order:", event.resource.id);

    // 3. Handle CHECKOUT.ORDER.APPROVED
    if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
      // The order was approved by the buyer on PayPal.
      // The capture should happen server-side via /api/subscription/capture
      // or we can capture it directly here for redundancy.
      console.log("[webhook] Order approved, waiting for capture:", event.resource.id);
    }

    // 4. Handle PAYMENT.CAPTURE.COMPLETED — the main event
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = event.resource.id;

      // Extract custom data
      let userId: string | undefined;
      let plan: string | undefined;

      try {
        // Try from custom_id on the resource
        if (event.resource.custom_id) {
          const parsed = JSON.parse(event.resource.custom_id);
          userId = parsed.userId;
          plan = parsed.plan;
        }

        // Try from purchase_units custom_id
        if (!userId && event.resource.purchase_units?.[0]?.custom_id) {
          const parsed = JSON.parse(event.resource.purchase_units[0].custom_id);
          userId = parsed.userId;
          plan = parsed.plan;
        }
      } catch {
        // ignore
      }

      if (userId && plan) {
        await activateSubscription(userId, plan, orderId);
        return NextResponse.json(
          { received: true, action: "subscription_activated" },
          { headers: securityHeaders() }
        );
      } else {
        // Fallback: look up payment request by txRef
        console.log("[webhook] No custom_id found, looking up payment request for order:", orderId);
        const paymentReq = await db.paymentRequest.findFirst({
          where: { txRef: orderId },
        });

        if (paymentReq) {
          await activateSubscription(paymentReq.userId, paymentReq.plan, orderId);
          return NextResponse.json(
            { received: true, action: "subscription_activated_via_lookup" },
            { headers: securityHeaders() }
          );
        }

        console.warn("[webhook] Could not find user for order:", orderId);
      }
    }

    // 5. Handle PAYMENT.CAPTURE.DENIED / PAYMENT.CAPTURE.DECLINED
    if (
      event.event_type === "PAYMENT.CAPTURE.DENIED" ||
      event.event_type === "PAYMENT.CAPTURE.DECLINED"
    ) {
      console.warn("[webhook] Payment denied/declined for order:", event.resource.id);
      // Optionally update payment request status
    }

    // Acknowledge receipt for other events
    return NextResponse.json(
      { received: true },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error("[webhook] Unhandled error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500, headers: securityHeaders() }
    );
  }
}

// GET not allowed
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: securityHeaders() }
  );
}
