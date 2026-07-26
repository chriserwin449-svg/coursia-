import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createPayPalSubscription,
  getPayPalConfig,
  isSubscriptionConfigured,
} from "@/lib/paypal";

// Ensure all required columns exist (PostgreSQL safety)
async function ensureColumns(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.startsWith("file:")) return;
  try {
    const cols: [string, string][] = [
      ["hasCardOnFile", "BOOLEAN NOT NULL DEFAULT false"],
      ["freeCourseUsed", "BOOLEAN NOT NULL DEFAULT false"],
      ["subscriptionPlan", "TEXT NOT NULL DEFAULT 'free'"],
      ["subscriptionStatus", "TEXT NOT NULL DEFAULT 'none'"],
      ["subscriptionStartDate", "TIMESTAMP(3)"],
      ["subscriptionEndDate", "TIMESTAMP(3)"],
      ["creemSubscriptionId", "TEXT"],
    ];
    for (const [col, def] of cols) {
      try {
        await db.$executeRawUnsafe(
          `DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "${col}" ${def}; EXCEPTION WHEN duplicate_column THEN null; END $$;`
        );
      } catch { /* non-critical */ }
    }
  } catch { /* non-critical */ }
}

// ─── Rate limiting (in-memory, per-user) ──────────────────────────────────
const checkoutAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_CHECKOUT_ATTEMPTS = 3;
const CHECKOUT_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = checkoutAttempts.get(userId);

  if (!record || now > record.resetAt) {
    checkoutAttempts.set(userId, { count: 1, resetAt: now + CHECKOUT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_CHECKOUT_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of checkoutAttempts) {
    if (now > val.resetAt) checkoutAttempts.delete(key);
  }
}, 300_000);

// ─── Price configuration (server-side, tamper-proof) ────────────────────
// Used only for the DB record (PaymentRequest.amount). The actual charge amount
// is defined by the PayPal Plan, so these values must match the Plan price.
const PLAN_CONFIG = {
  monthly: { amount: 999, currency: "USD" },   // $9.99
  annual: { amount: 5299, currency: "USD" },   // $52.99
} as const;

type PlanType = keyof typeof PLAN_CONFIG;

// ─── Input validation ──────────────────────────────────────────────────────
function isValidPlan(plan: string): plan is PlanType {
  return plan === "monthly" || plan === "annual";
}

function isValidUserId(userId: string): boolean {
  // Accept both cuid (clxxx...) and standard UUID (xxx-xxx-xxx) formats
  const idRegex = /^[a-z0-9-]+$/;
  return userId.length > 5 && userId.length < 50 && idRegex.test(userId);
}

// ─── Security headers ────────────────────────────────────────────────────
function securityHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}

// ─── Main handler ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    await ensureColumns();

    // 0. Check PayPal configuration
    try {
      getPayPalConfig();
    } catch {
      return NextResponse.json(
        { error: "PayPal is not configured yet. Please configure PayPal credentials to enable payments.", code: "PAYPAL_NOT_CONFIGURED" },
        { status: 503, headers: securityHeaders() }
      );
    }

    // 0b. Check that subscription plan IDs are configured
    if (!isSubscriptionConfigured()) {
      return NextResponse.json(
        { error: "Recurring subscription plans are not configured. Set PAYPAL_MONTHLY_PLAN_ID and PAYPAL_ANNUAL_PLAN_ID.", code: "PAYPAL_PLANS_NOT_CONFIGURED" },
        { status: 503, headers: securityHeaders() }
      );
    }

    // 1. Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: securityHeaders() }
      );
    }

    const { plan, userId, locale } = body as Record<string, unknown>;

    // 2. Validate plan
    if (!plan || typeof plan !== "string" || !isValidPlan(plan)) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 3. Validate userId
    if (!userId || typeof userId !== "string" || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 4. Rate limiting
    if (!checkRateLimit(userId)) {
      console.warn(`[checkout] Rate limited for user: ${userId}`);
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429, headers: securityHeaders() }
      );
    }

    // 5. Check if user exists and doesn't already have an active subscription
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found. Please sign up first." },
        { status: 404, headers: securityHeaders() }
      );
    }

    if (user?.subscriptionStatus === "active") {
      return NextResponse.json(
        { error: "Already subscribed" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 6. Create payment request record in DB
    const planConfig = PLAN_CONFIG[plan];
    const paymentRequest = await db.paymentRequest.create({
      data: {
        userId,
        plan,
        amount: planConfig.amount,
        currency: planConfig.currency,
        status: "pending",
        txRef: `paypal_sub_init_${Date.now()}`,
      },
    });

    console.log("[checkout] Payment request created:", {
      plan,
      amount: planConfig.amount,
      userId: userId.slice(0, 8) + "...",
      requestId: paymentRequest.id,
    });

    // 7. Create PayPal SUBSCRIPTION (recurring) — not a one-time order
    const paypalResult = await createPayPalSubscription({
      plan,
      userId,
      userEmail: user?.email || undefined,
      requestId: paymentRequest.id,
      locale: typeof locale === "string" ? locale : undefined,
    });

    // 8. Update payment request with PayPal subscription ID
    await db.paymentRequest.update({
      where: { id: paymentRequest.id },
      data: {
        txRef: paypalResult.subscriptionId, // Store PayPal subscription ID as txRef
      },
    });

    console.log("[checkout] PayPal subscription created:", {
      subscriptionId: paypalResult.subscriptionId,
      status: paypalResult.status,
      requestId: paymentRequest.id,
    });

    // 9. Return PayPal subscription details to frontend
    return NextResponse.json(
      {
        success: true,
        subscriptionId: paypalResult.subscriptionId,
        approveUrl: paypalResult.approveUrl,
        status: paypalResult.status,
        requestId: paymentRequest.id,
        amount: planConfig.amount,
        currency: planConfig.currency,
        plan,
        mode: "subscription", // tells frontend this is a recurring subscription
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error("[checkout] Unhandled error:", error);

    // Classify errors for better frontend handling
    const err = error as Error & { code?: string };
    const errorCode = err.code || "CHECKOUT_UNKNOWN";
    const errMsg = err.message || "Unknown error";

    // Log specific error types
    if (errorCode.includes("PAYPAL_AUTH")) {
      console.error("[checkout] PayPal credentials invalid — check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET");
    } else if (errorCode.includes("PAYPAL_VALIDATION")) {
      console.error("[checkout] PayPal subscription validation failed:", errMsg);
    }

    return NextResponse.json(
      { error: "Payment initialization failed", details: errMsg, code: errorCode },
      { status: 500, headers: securityHeaders() }
    );
  }
}
