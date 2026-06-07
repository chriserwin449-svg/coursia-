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

// ─── Database column auto-migration (for Supabase/PostgreSQL) ──────────
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
    await migrateColumn("User", "paymentProvider", "TEXT NOT NULL DEFAULT 'none'");
  } catch { /* non-critical */ }
}

// ─── Flutterwave webhook signature verification (SHA512) ──────────────
const FLW_WEBHOOK_SECRET = process.env.FLW_WEBHOOK_SECRET || "";

function verifyFlutterwaveSignature(payload: string, signature: string): boolean {
  if (!FLW_WEBHOOK_SECRET) {
    console.error("[webhook] FLW_WEBHOOK_SECRET not configured");
    return false;
  }
  if (!signature || signature.length < 10) {
    console.warn("[webhook] Missing or invalid signature");
    return false;
  }

  // Flutterwave uses SHA512 of raw body + webhook secret hash
  const expected = crypto
    .createHash("sha512")
    .update(payload + FLW_WEBHOOK_SECRET)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

// ─── Transaction verification with Flutterwave API ──────────────────────
async function verifyTransaction(transactionId: number): Promise<{
  verified: boolean;
  txRef?: string;
  amount?: number;
  currency?: string;
  status?: string;
  customerEmail?: string;
  customerName?: string;
  meta?: Record<string, string>;
}> {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    console.error("[webhook] FLW_SECRET_KEY not set for verification");
    return { verified: false };
  }

  try {
    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": secretKey,
        },
      }
    );

    const data = await res.json();

    if (data.status === "success" && data.data?.status === "successful") {
      return {
        verified: true,
        txRef: data.data.tx_ref,
        amount: data.data.amount,
        currency: data.data.currency,
        status: data.data.status,
        customerEmail: data.data.customer?.email,
        customerName: data.data.customer?.name,
        meta: data.data.meta,
      };
    }

    console.warn("[webhook] Transaction verification failed:", {
      id: transactionId,
      status: data.data?.status,
      message: data.message,
    });

    return { verified: false };
  } catch (err) {
    console.error("[webhook] Transaction verification error:", err);
    return { verified: false };
  }
}

// ─── Timestamp freshness check (anti-replay) ────────────────────────────
function isEventFresh(eventTimestamp: string | number | undefined): boolean {
  if (!eventTimestamp) return true;
  const ts = typeof eventTimestamp === "string"
    ? new Date(eventTimestamp).getTime()
    : eventTimestamp;
  const now = Date.now();
  const ageMs = now - ts;
  // Reject events older than 30 minutes or from the future (> 5 min)
  return ageMs > -300_000 && ageMs < 1_800_000;
}

// ─── Subscription management ────────────────────────────────────────────
async function grantSubscription(
  customerEmail: string,
  transactionRef: string,
  customerId: string,
  plan: string,
  provider: string
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
      creemSubscriptionId: transactionRef, // Reuse column for Flutterwave tx_ref
      creemCustomerId: customerId,         // Reuse column for Flutterwave customer ID
      subscriptionStartDate: new Date(),
      subscriptionEndDate: null,
      paymentProvider: provider,
      updatedAt: new Date(),
    },
  });

  console.log(`[webhook] Subscription activated for ${customerEmail} (${plan}, ${provider})`);
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
    const signature = request.headers.get("verif-hash") || "";

    // 2. Verify Flutterwave SHA512 signature (constant-time comparison)
    if (!verifyFlutterwaveSignature(body, signature)) {
      console.warn("[webhook] Invalid Flutterwave signature");
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

    const eventType = String(event.event || "");
    const eventData = event.data as Record<string, unknown> | undefined;
    const eventId = String(eventData?.id || eventData?.tx_ref || "");
    const transactionId = Number(eventData?.id || 0);

    console.log(`[webhook] Received event: ${eventType} (id: ${eventId}, tx: ${String(eventData?.tx_ref || "").slice(0, 20)})`);

    // 4. Idempotency check
    if (isEventProcessed(eventId)) {
      console.log(`[webhook] Event already processed: ${eventId}`);
      return NextResponse.json(
        { received: true, idempotent: true },
        { headers: securityHeaders() }
      );
    }

    // 5. Anti-replay: check timestamp freshness
    const eventTs = String(eventData?.created_at || event.created_at);
    if (!isEventFresh(eventTs)) {
      console.warn(`[webhook] Stale or future-dated event rejected: ${eventType}`);
      return NextResponse.json(
        { error: "Event timestamp out of range" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 6. Auto-migrate columns if needed
    await ensureAllColumns();

    // 7. Route events
    switch (eventType) {
      case "charge.completed": {
        // Only process successful charges
        const chargeStatus = String(eventData?.status || "").toLowerCase();
        if (chargeStatus !== "successful") {
          console.log(`[webhook] Charge not successful (${chargeStatus}), skipping`);
          break;
        }

        // Double-verify with Flutterwave API to prevent fraud
        if (transactionId > 0) {
          const verification = await verifyTransaction(transactionId);

          if (!verification.verified) {
            console.error("[webhook] Transaction verification failed, rejecting:", transactionId);
            break;
          }

          // Use verified data (more reliable than webhook payload)
          const customerEmail = verification.customerEmail
            || String(eventData?.customer?.email || "");
          const customerId = String(eventData?.customer?.id || "");
          const txRef = verification.txRef || String(eventData?.tx_ref || "");
          const plan = (verification.meta?.plan as string)
            || (eventData?.meta as Record<string, string>)?.plan
            || "monthly";

          if (customerEmail) {
            await grantSubscription(
              customerEmail,
              txRef,
              customerId,
              plan,
              "flutterwave"
            );
          }
        }
        break;
      }

      case "transfer.completed":
      case "transfer.failed": {
        // Payout events — log for monitoring
        console.log(`[webhook] Transfer event: ${eventType}`, {
          amount: eventData?.amount,
          status: eventData?.status,
        });
        break;
      }

      case "subscription.cancel":
      case "subscription.expiry": {
        const customerEmail = String(eventData?.customer?.email || "");
        const reason = eventType === "subscription.expiry" ? "expired" : "canceled";

        if (customerEmail) {
          await revokeSubscription(customerEmail, reason);
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
