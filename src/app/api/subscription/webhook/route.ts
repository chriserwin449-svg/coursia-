import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as crypto from "crypto";

// ─── Idempotency: prevent duplicate webhook processing ───────────────────
const processedEvents = new Map<string, number>(); // eventId → timestamp
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of processedEvents) {
    if (now - ts > IDEMPOTENCY_WINDOW_MS) processedEvents.delete(key);
  }
}, 600_000);

function isEventProcessed(eventId: string): boolean {
  if (!eventId) return false;
  return processedEvents.has(eventId);
}

function markEventProcessed(eventId: string): void {
  if (eventId) {
    processedEvents.set(eventId, Date.now());
  }
}

// ─── Database column auto-migration ─────────────────────────────────────
async function migrateColumn(table: string, col: string, colDef: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `DO $$ BEGIN ALTER TABLE "${table}" ADD COLUMN "${col}" ${colDef}; EXCEPTION WHEN duplicate_column THEN null; END $$;`
    );
  } catch { /* non-critical */ }
}

async function ensureAllColumns(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.startsWith("file:")) return;
  try {
    await migrateColumn("User", "subscriptionPlan", "TEXT NOT NULL DEFAULT 'free'");
    await migrateColumn("User", "subscriptionStatus", "TEXT NOT NULL DEFAULT 'none'");
    await migrateColumn("User", "creemSubscriptionId", "TEXT");
    await migrateColumn("User", "creemCustomerId", "TEXT");
    await migrateColumn("User", "subscriptionStartDate", "TIMESTAMP(3)");
    await migrateColumn("User", "subscriptionEndDate", "TIMESTAMP(3)");
    await migrateColumn("User", "trialStartDate", "TIMESTAMP(3)");
  } catch { /* non-critical */ }
}

// ─── HMAC-SHA256 signature verification ─────────────────────────────────
const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET || "";

function verifySignature(payload: string, signature: string): boolean {
  if (!CREEM_WEBHOOK_SECRET) {
    console.error("[webhook] CREEM_WEBHOOK_SECRET not configured");
    return false;
  }
  if (!signature || signature.length < 10) {
    console.warn("[webhook] Missing or invalid signature");
    return false;
  }
  const computed = crypto
    .createHmac("sha256", CREEM_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

// ─── Timestamp freshness check (anti-replay) ────────────────────────────
function isEventFresh(eventTimestamp: string | number | undefined): boolean {
  if (!eventTimestamp) return true; // can't verify, allow through
  const ts = typeof eventTimestamp === "string" ? new Date(eventTimestamp).getTime() : eventTimestamp;
  const now = Date.now();
  const ageMs = now - ts;
  // Reject events older than 30 minutes or from the future (> 5 min)
  return ageMs > -300_000 && ageMs < 1_800_000;
}

// ─── Subscription management ────────────────────────────────────────────
async function grantSubscription(
  customerEmail: string,
  subscriptionId: string,
  customerId: string,
  plan: string
) {
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
      subscriptionEndDate: null,
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

// ─── Security headers ────────────────────────────────────────────────────
function securityHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

// ─── Main handler ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("creem-signature") || "";

    // 2. Verify HMAC signature (constant-time comparison)
    if (!verifySignature(body, signature)) {
      console.warn("[webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401, headers: securityHeaders() }
      );
    }

    // 3. Parse event
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(body);
    } catch {
      console.warn("[webhook] Invalid JSON body");
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400, headers: securityHeaders() }
      );
    }

    const eventType = (event.type as string) || (event.event_type as string) || "";
    const eventId = (event.id as string) || (event.data?.id as string) || "";

    console.log(`[webhook] Received event: ${eventType} (id: ${eventId?.slice(0, 12) || "unknown"})`);

    // 4. Idempotency check
    if (isEventProcessed(eventId)) {
      console.log(`[webhook] Event already processed: ${eventId}`);
      return NextResponse.json(
        { received: true, idempotent: true },
        { headers: securityHeaders() }
      );
    }

    // 5. Anti-replay: check timestamp freshness
    const eventTs = (event.data?.timestamp as string) || (event.created_at as string);
    if (!isEventFresh(eventTs)) {
      console.warn(`[webhook] Stale or future-dated event rejected: ${eventType}`);
      return NextResponse.json(
        { error: "Event timestamp out of range" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 6. Auto-migrate columns if needed
    await ensureAllColumns();

    // 7. Route event
    switch (eventType) {
      case "subscription.active":
      case "subscription.paid": {
        const customer = event.data?.customer || event.customer;
        const subscription = event.data?.subscription || event.subscription;
        const metadata = event.data?.metadata || event.metadata;

        if (customer?.email && subscription?.id) {
          const plan = metadata?.plan || "monthly";
          await grantSubscription(
            String(customer.email),
            String(subscription.id),
            String(customer.id || ""),
            String(plan)
          );
        }
        break;
      }

      case "checkout.completed": {
        const customer = event.data?.customer || event.customer;
        const subscription = event.data?.subscription || event.subscription;
        const metadata = event.data?.metadata || event.metadata;

        if (customer?.email && subscription?.id) {
          const plan = metadata?.plan || "monthly";
          await grantSubscription(
            String(customer.email),
            String(subscription.id),
            String(customer.id || ""),
            String(plan)
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
          await revokeSubscription(String(customer.email), reason);
        }
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${eventType}`);
    }

    // 8. Mark as processed
    markEventProcessed(eventId);

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

// ─── Reject other methods ────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: securityHeaders() }
  );
}
