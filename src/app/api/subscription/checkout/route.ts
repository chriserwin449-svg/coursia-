import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPayPalOrder, getPayPalConfig } from "@/lib/paypal";

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
const PLAN_CONFIG = {
  monthly: { amount: 999, currency: "USD" },
  annual: { amount: 4299, currency: "USD" },
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
    // 0. Check PayPal configuration
    try {
      getPayPalConfig();
    } catch {
      return NextResponse.json(
        { error: "PayPal is not configured yet. Please configure PayPal credentials to enable payments.", code: "PAYPAL_NOT_CONFIGURED" },
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
        txRef: `paypal_init_${Date.now()}`,
      },
    });

    console.log("[checkout] Payment request created:", {
      plan,
      amount: planConfig.amount,
      userId: userId.slice(0, 8) + "...",
      requestId: paymentRequest.id,
    });

    // 7. Create PayPal order
    const paypalResult = await createPayPalOrder({
      plan,
      userId,
      userEmail: user?.email || undefined,
      requestId: paymentRequest.id,
      locale: typeof locale === "string" ? locale : undefined,
    });

    // 8. Update payment request with PayPal order ID
    await db.paymentRequest.update({
      where: { id: paymentRequest.id },
      data: {
        txRef: paypalResult.orderId, // Store PayPal order ID as txRef
      },
    });

    console.log("[checkout] PayPal order created:", {
      orderId: paypalResult.orderId,
      requestId: paymentRequest.id,
    });

    // 9. Return PayPal order details to frontend
    return NextResponse.json(
      {
        success: true,
        orderId: paypalResult.orderId,
        approveUrl: paypalResult.approveUrl,
        requestId: paymentRequest.id,
        amount: planConfig.amount,
        currency: planConfig.currency,
        plan,
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
      console.error("[checkout] PayPal order validation failed:", errMsg);
    }

    return NextResponse.json(
      { error: "Payment initialization failed", details: errMsg, code: errorCode },
      { status: 500, headers: securityHeaders() }
    );
  }
}
