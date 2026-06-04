import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as crypto from "crypto";

const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET || "";

function verifySignature(payload: string, signature: string): boolean {
  if (!CREEM_WEBHOOK_SECRET) {
    console.error("[webhook] CREEM_WEBHOOK_SECRET not configured");
    return false;
  }
  const computed = crypto
    .createHmac("sha256", CREEM_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  return computed === signature;
}

async function grantSubscription(
  customerEmail: string,
  subscriptionId: string,
  customerId: string,
  plan: string
) {
  // Find user by email and update subscription
  const user = await db.user.findUnique({ where: { email: customerEmail } });
  if (!user) {
    console.warn(`[webhook] User not found for email: ${customerEmail}`);
    return;
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      subscriptionPlan: plan === "annual" ? "annual" : "monthly",
      subscriptionStatus: "active",
      creemSubscriptionId: subscriptionId,
      creemCustomerId: customerId,
      subscriptionStartDate: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`[webhook] Subscription activated for ${customerEmail} (${plan})`);
}

async function revokeSubscription(customerEmail: string, reason: string) {
  const user = await db.user.findUnique({ where: { email: customerEmail } });
  if (!user) {
    console.warn(`[webhook] User not found for email: ${customerEmail}`);
    return;
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: reason === "expired" ? "expired" : "canceled",
      subscriptionEndDate: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`[webhook] Subscription ${reason} for ${customerEmail}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("creem-signature") || "";

    if (!verifySignature(body, signature)) {
      console.warn("[webhook] Invalid signature");
      return NextResponse.status(401).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(body);
    const eventType = event.type || event.event_type;

    console.log(`[webhook] Received event: ${eventType}`);

    switch (eventType) {
      case "subscription.active":
      case "subscription.paid": {
        const customer = event.data?.customer || event.customer;
        const subscription = event.data?.subscription || event.subscription;
        const metadata = event.data?.metadata || event.metadata;

        if (customer?.email && subscription?.id) {
          const plan = metadata?.plan || "monthly";
          await grantSubscription(
            customer.email,
            subscription.id,
            customer.id || "",
            plan
          );
        }
        break;
      }

      case "checkout.completed": {
        // One-time payment - also handle subscription creation if it came with one
        const customer = event.data?.customer || event.customer;
        const subscription = event.data?.subscription || event.subscription;
        const metadata = event.data?.metadata || event.metadata;

        if (customer?.email && subscription?.id) {
          const plan = metadata?.plan || "monthly";
          await grantSubscription(
            customer.email,
            subscription.id,
            customer.id || "",
            plan
          );
        }
        break;
      }

      case "subscription.canceled":
      case "subscription.scheduled_cancel":
      case "subscription.expired":
      case "subscription.past_due": {
        const customer = event.data?.customer || event.customer;
        const reason = eventType === "expired" ? "expired" : "canceled";

        if (customer?.email) {
          await revokeSubscription(customer.email, reason);
        }
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
