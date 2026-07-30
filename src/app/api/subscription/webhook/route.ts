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

// ─── Custom ID parser (PayPal puts our metadata here) ────────────────────
interface CustomMeta {
  userId?: string;
  plan?: string;
  requestId?: string;
}

function parseCustomId(raw?: string): CustomMeta {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CustomMeta;
  } catch {
    return {};
  }
}

// ─── Activate subscription helper (idempotent) ─────────────────────────────
// Activates the user's subscription in our DB. For recurring subscriptions,
// we use the next_billing_time returned by PayPal as the end date, falling
// back to a 30/365 day estimate if not available.
async function activateSubscription(
  userId: string,
  plan: string,
  subscriptionId: string,
  payerEmail?: string,
  nextBillingTime?: string
): Promise<{ activated: boolean; wasAlreadyActive: boolean }> {
  try {
    // Card verification flow (kept for backwards-compat, not used by subscriptions)
    if (plan === "card_verify") {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { hasCardOnFile: true },
      });

      if (user?.hasCardOnFile) {
        console.log(`[webhook] Card already on file for user ${userId.slice(0, 8)}... — skipping`);
        return { activated: false, wasAlreadyActive: true };
      }

      await db.user.update({
        where: { id: userId },
        data: { hasCardOnFile: true },
      });

      await db.paymentRequest.updateMany({
        where: { userId, plan: "card_verify", status: "pending" },
        data: {
          status: "approved",
          adminNote: `Card verified via PayPal webhook: ${subscriptionId}${payerEmail ? ` | payer: ${payerEmail}` : ""}`,
          txRef: subscriptionId,
        },
      });

      console.log(`[webhook] Card verified via webhook for user ${userId.slice(0, 8)}...`);
      return { activated: true, wasAlreadyActive: false };
    }

    // Check if user already has an active subscription (idempotency guard)
    const existingUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        subscriptionPlan: true,
        creemSubscriptionId: true,
      },
    });

    // If the SAME subscription is already tracked, just refresh end date
    const sameSubscription = existingUser?.creemSubscriptionId === `paypal_${subscriptionId}`;

    if (existingUser?.subscriptionStatus === "active" && sameSubscription) {
      console.log(
        `[webhook] User ${userId.slice(0, 8)}... already active with same subscription — refreshing end date only`
      );
    } else if (existingUser?.subscriptionStatus === "active" && !sameSubscription) {
      console.log(
        `[webhook] User ${userId.slice(0, 8)}... already active but with different subscription — updating to new one`
      );
    }

    // Compute end date: prefer PayPal's next billing time, fallback to 30/365 days
    const now = new Date();
    let endDate: Date;
    if (nextBillingTime) {
      endDate = new Date(nextBillingTime);
      if (isNaN(endDate.getTime())) {
        // Invalid date — fallback
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
      where: { id: userId },
      data: {
        subscriptionPlan: plan,
        subscriptionStatus: "active",
        subscriptionStartDate: now,
        subscriptionEndDate: endDate,
        creemSubscriptionId: `paypal_${subscriptionId}`,
        hasCardOnFile: true,
      },
    });

    // Mark payment request as approved (idempotent — updateMany only affects pending)
    await db.paymentRequest.updateMany({
      where: {
        userId,
        plan,
        status: "pending",
      },
      data: {
        status: "approved",
        adminNote: `Auto-approved via PayPal webhook: ${subscriptionId}${payerEmail ? ` | payer: ${payerEmail}` : ""}`,
        txRef: subscriptionId,
      },
    });

    console.log(
      `[webhook] Subscription activated for user ${userId.slice(0, 8)}..., plan=${plan}, subId=${subscriptionId.slice(0, 12)}..., ends=${endDate.toISOString()}`
    );

    return { activated: true, wasAlreadyActive: false };
  } catch (error) {
    console.error("[webhook] Failed to activate subscription:", error);
    return { activated: false, wasAlreadyActive: false };
  }
}

// ─── Extend subscription end date on recurring payment ───────────────────
// Called when PAYMENT.SALE.COMPLETED fires for an existing subscription.
// This is the recurring billing event — extends the user's access for another cycle.
async function extendSubscription(
  subscriptionId: string,
  nextBillingTime?: string
): Promise<void> {
  try {
    // Find the user by their PayPal subscription ID (stored as "paypal_<id>")
    const user = await db.user.findFirst({
      where: { creemSubscriptionId: `paypal_${subscriptionId}` },
      select: { id: true, subscriptionPlan: true, subscriptionStatus: true },
    });

    if (!user) {
      console.warn(`[webhook] extendSubscription: no user found for sub ${subscriptionId.slice(0, 12)}...`);
      return;
    }

    // Compute new end date
    const now = new Date();
    let endDate: Date;
    if (nextBillingTime) {
      endDate = new Date(nextBillingTime);
      if (isNaN(endDate.getTime())) {
        const duration = user.subscriptionPlan === "annual" ? 365 : 30;
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() + duration);
      }
    } else {
      const duration = user.subscriptionPlan === "annual" ? 365 : 30;
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + duration);
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: "active",
        subscriptionEndDate: endDate,
        // Reset start date to now so renewal banner logic works correctly
        subscriptionStartDate: now,
      },
    });

    console.log(
      `[webhook] Subscription extended for user ${user.id.slice(0, 8)}..., plan=${user.subscriptionPlan}, new ends=${endDate.toISOString()}`
    );
  } catch (error) {
    console.error("[webhook] Failed to extend subscription:", error);
  }
}

// ─── Mark subscription as canceled/expired ────────────────────────────────
async function markSubscriptionStatus(
  subscriptionId: string,
  status: "canceled" | "expired" | "suspended"
): Promise<void> {
  try {
    const user = await db.user.findFirst({
      where: { creemSubscriptionId: `paypal_${subscriptionId}` },
      select: { id: true },
    });

    if (!user) {
      console.warn(`[webhook] markSubscriptionStatus: no user found for sub ${subscriptionId.slice(0, 12)}...`);
      return;
    }

    await db.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: status },
    });

    console.log(
      `[webhook] Subscription ${status} for user ${user.id.slice(0, 8)}... (sub ${subscriptionId.slice(0, 12)}...)`
    );
  } catch (error) {
    console.error("[webhook] Failed to mark subscription status:", error);
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
      console.error("[webhook] ⚠️ INVALID SIGNATURE — rejecting webhook (this could be an attack in live mode)");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 403, headers: securityHeaders() }
      );
    }

    // 2. Parse webhook event — support both subscription & legacy order events
    const event = JSON.parse(body) as {
      event_type: string;
      resource: {
        id: string;
        status?: string;
        custom_id?: string;
        // Subscription fields
        plan_id?: string;
        start_time?: string;
        billing_info?: {
          next_billing_time?: string;
        };
        subscriber?: {
          email_address?: string;
          payer_id?: string;
        };
        // Legacy order fields
        purchase_units?: Array<{ custom_id?: string; reference_id?: string }>;
        amount?: { currency_code: string; value: string };
        payer?: { email_address?: string };
        // Sale (recurring payment) fields — resource is a sale object
        billing_agreement_id?: string;
      };
      id: string;
      create_time: string;
    };

    console.log("[webhook] ✅ Received verified event:", event.event_type, "for resource:", event.resource.id);

    // ─── SUBSCRIPTION EVENTS (recurring billing) ───────────────────────────

    // 3a. BILLING.SUBSCRIPTION.ACTIVATED — user just approved a new subscription
    if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") {
      const subscriptionId = event.resource.id;
      const meta = parseCustomId(event.resource.custom_id);
      const payerEmail = event.resource.subscriber?.email_address;
      const nextBillingTime = event.resource.billing_info?.next_billing_time;

      // If no custom_id, look up the payment request by subscription ID (txRef)
      if (!meta.userId || !meta.plan) {
        const paymentReq = await db.paymentRequest.findFirst({
          where: { txRef: subscriptionId },
        });
        if (paymentReq) {
          meta.userId = paymentReq.userId;
          meta.plan = paymentReq.plan;
        }
      }

      if (meta.userId && meta.plan) {
        const result = await activateSubscription(
          meta.userId,
          meta.plan,
          subscriptionId,
          payerEmail,
          nextBillingTime
        );
        return NextResponse.json(
          { received: true, action: result.activated ? "subscription_activated" : "already_active" },
          { headers: securityHeaders() }
        );
      }

      console.warn("[webhook] BILLING.SUBSCRIPTION.ACTIVATED: no user/plan found for sub:", subscriptionId);
    }

    // 3b. PAYMENT.SALE.COMPLETED — recurring payment succeeded (monthly/annual cycle)
    // For subscriptions, event.resource.billing_agreement_id is the subscription ID
    if (event.event_type === "PAYMENT.SALE.COMPLETED") {
      const subscriptionId = event.resource.billing_agreement_id;
      const nextBillingTime = event.resource.billing_info?.next_billing_time;

      if (subscriptionId) {
        await extendSubscription(subscriptionId, nextBillingTime);
        return NextResponse.json(
          { received: true, action: "subscription_extended" },
          { headers: securityHeaders() }
        );
      }

      // Fallback: this might be a legacy one-time order payment (capture completed)
      // Try to extract custom data from the sale resource
      let userId: string | undefined;
      let plan: string | undefined;
      try {
        if (event.resource.custom_id) {
          const parsed = JSON.parse(event.resource.custom_id);
          userId = parsed.userId;
          plan = parsed.plan;
        }
        if (!userId && event.resource.purchase_units?.[0]?.custom_id) {
          const parsed = JSON.parse(event.resource.purchase_units[0].custom_id);
          userId = parsed.userId;
          plan = parsed.plan;
        }
      } catch {
        // ignore parse errors
      }

      if (userId && plan) {
        const result = await activateSubscription(userId, plan, event.resource.id);
        return NextResponse.json(
          { received: true, action: result.activated ? "subscription_activated" : "already_active" },
          { headers: securityHeaders() }
        );
      }

      // Last resort: look up by txRef
      const paymentReq = await db.paymentRequest.findFirst({
        where: { txRef: event.resource.id },
      });
      if (paymentReq) {
        const result = await activateSubscription(paymentReq.userId, paymentReq.plan, event.resource.id);
        return NextResponse.json(
          { received: true, action: result.activated ? "subscription_activated_via_lookup" : "already_active" },
          { headers: securityHeaders() }
        );
      }

      console.warn("[webhook] PAYMENT.SALE.COMPLETED: no subscription/payment found for:", event.resource.id);
    }

    // 3c. BILLING.SUBSCRIPTION.CANCELLED — user (or system) canceled the subscription
    if (event.event_type === "BILLING.SUBSCRIPTION.CANCELLED") {
      await markSubscriptionStatus(event.resource.id, "canceled");
      return NextResponse.json(
        { received: true, action: "subscription_canceled" },
        { headers: securityHeaders() }
      );
    }

    // 3d. BILLING.SUBSCRIPTION.EXPIRED — subscription reached end of its life
    if (event.event_type === "BILLING.SUBSCRIPTION.EXPIRED") {
      await markSubscriptionStatus(event.resource.id, "expired");
      return NextResponse.json(
        { received: true, action: "subscription_expired" },
        { headers: securityHeaders() }
      );
    }

    // 3e. BILLING.SUBSCRIPTION.SUSPENDED — subscription paused (e.g. payment failure)
    if (event.event_type === "BILLING.SUBSCRIPTION.SUSPENDED") {
      await markSubscriptionStatus(event.resource.id, "suspended");
      return NextResponse.json(
        { received: true, action: "subscription_suspended" },
        { headers: securityHeaders() }
      );
    }

    // 3f. BILLING.SUBSCRIPTION.UPDATED — plan changed, just log
    if (event.event_type === "BILLING.SUBSCRIPTION.UPDATED") {
      console.log("[webhook] Subscription updated:", event.resource.id, "status:", event.resource.status);
      return NextResponse.json(
        { received: true, action: "subscription_updated" },
        { headers: securityHeaders() }
      );
    }

    // ─── LEGACY / FALLBACK EVENTS ──────────────────────────────────────────

    // CHECKOUT.ORDER.APPROVED — legacy, from one-time order flow
    if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
      console.log("[webhook] Legacy order approved, waiting for capture:", event.resource.id);
    }

    // PAYMENT.CAPTURE.COMPLETED — legacy one-time payment
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = event.resource.id;
      let userId: string | undefined;
      let plan: string | undefined;

      try {
        if (event.resource.custom_id) {
          const parsed = JSON.parse(event.resource.custom_id);
          userId = parsed.userId;
          plan = parsed.plan;
        }
        if (!userId && event.resource.purchase_units?.[0]?.custom_id) {
          const parsed = JSON.parse(event.resource.purchase_units[0].custom_id);
          userId = parsed.userId;
          plan = parsed.plan;
        }
      } catch {
        // ignore parse errors
      }

      if (userId && plan) {
        const result = await activateSubscription(userId, plan, orderId);
        return NextResponse.json(
          { received: true, action: result.activated ? "subscription_activated" : "already_active" },
          { headers: securityHeaders() }
        );
      }

      // Fallback: look up payment request by txRef
      const paymentReq = await db.paymentRequest.findFirst({
        where: { txRef: orderId },
      });
      if (paymentReq) {
        const result = await activateSubscription(paymentReq.userId, paymentReq.plan, orderId);
        return NextResponse.json(
          { received: true, action: result.activated ? "subscription_activated_via_lookup" : "already_active" },
          { headers: securityHeaders() }
        );
      }

      console.warn("[webhook] Could not find user for legacy order:", orderId);
    }

    // PAYMENT.CAPTURE.DENIED / PAYMENT.CAPTURE.DECLINED
    if (
      event.event_type === "PAYMENT.CAPTURE.DENIED" ||
      event.event_type === "PAYMENT.CAPTURE.DECLINED" ||
      event.event_type === "PAYMENT.SALE.DENIED"
    ) {
      console.warn("[webhook] Payment denied/declined for resource:", event.resource.id);

      try {
        await db.paymentRequest.updateMany({
          where: { txRef: event.resource.id, status: "pending" },
          data: {
            status: "failed",
            adminNote: `PayPal webhook: ${event.event_type}`,
          },
        });
      } catch {
        // ignore DB errors for status updates
      }
    }

    // Acknowledge receipt for all other events
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
