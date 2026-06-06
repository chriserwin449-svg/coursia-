import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as crypto from "crypto";

// ─── Rate limiting (in-memory, per-user) ──────────────────────────────────
const checkoutAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_CHECKOUT_ATTEMPTS = 5; // per user per window
const CHECKOUT_WINDOW_MS = 60_000; // 1 minute

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

// ─── Cleanup old rate limit entries every 5 minutes ─────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of checkoutAttempts) {
    if (now > val.resetAt) checkoutAttempts.delete(key);
  }
}, 300_000);

// ─── Price configuration (server-side, tamper-proof) ────────────────────
const PLAN_CONFIG = {
  monthly: { amountCents: 999, currency: "usd" },
  annual: { amountCents: 2899, currency: "usd" },
} as const;

type PlanType = keyof typeof PLAN_CONFIG;

// ─── Input sanitization ──────────────────────────────────────────────────
function isValidPlan(plan: string): plan is PlanType {
  return plan === "monthly" || plan === "annual";
}

function isValidUserId(userId: string): boolean {
  // UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeString(str: string): string {
  // Remove potentially dangerous characters
  return str.replace(/[<>'"&;(){}[\]]/g, "").trim().slice(0, 255);
}

// ─── Security headers ────────────────────────────────────────────────────
function securityHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

// ─── nonce generation for idempotency ────────────────────────────────────
function generateCheckoutNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

// ─── Main handler ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
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

    const { plan, userId } = body as Record<string, unknown>;

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

    // 5. Check API key
    const apiKey = process.env.CREEM_API_KEY;
    if (!apiKey) {
      console.error("[checkout] CREEM_API_KEY not set");
      return NextResponse.json(
        { error: "Payment not configured" },
        { status: 500, headers: securityHeaders() }
      );
    }

    // 6. Check product IDs
    const productId =
      plan === "annual"
        ? process.env.CREEM_ANNUAL_PRODUCT_ID
        : process.env.CREEM_MONTHLY_PRODUCT_ID;

    if (!productId) {
      console.error("[checkout] Product ID not configured for plan:", plan);
      return NextResponse.json(
        { error: "Product not configured" },
        { status: 500, headers: securityHeaders() }
      );
    }

    // 7. Fetch user email from DB
    let customerEmail = "";
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      customerEmail = user?.email || "";
    } catch (dbErr) {
      console.warn("[checkout] Could not fetch user email:", dbErr);
    }

    // 8. Build checkout request
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coursia-8oi4.vercel.app";
    const nonce = generateCheckoutNonce();
    const successUrl = `${appUrl}/?payment=success&plan=${plan}&nonce=${encodeURIComponent(nonce)}`;

    const creemBase = apiKey.startsWith("creem_test_")
      ? "https://test-api.creem.io/v1"
      : "https://api.creem.io/v1";

    console.log("[checkout] Creating checkout:", {
      plan,
      productId,
      amount: PLAN_CONFIG[plan].amountCents,
      userId: userId.slice(0, 8) + "...",
      hasEmail: !!customerEmail,
      nonce: nonce.slice(0, 8) + "...",
    });

    // 9. Create Creem checkout
    const res = await fetch(`${creemBase}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        product_id: productId,
        success_url: successUrl,
        customer: customerEmail && isValidEmail(customerEmail)
          ? { email: customerEmail }
          : undefined,
        metadata: {
          userId: sanitizeString(userId),
          plan: sanitizeString(plan),
          nonce,
          appSource: "coursia",
          timestamp: Date.now().toString(),
        },
      }),
    });

    const data = await res.json();

    console.log("[checkout] Creem response:", {
      status: res.status,
      ok: res.ok,
      id: data.id,
      hasCheckoutUrl: !!data.checkout_url,
      error: data.error,
      mode: data.mode,
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: Array.isArray(data.message)
            ? data.message.join(", ")
            : (data.error || data.message || "Checkout creation failed"),
        },
        { status: res.status, headers: securityHeaders() }
      );
    }

    if (!data.checkout_url) {
      return NextResponse.json(
        { error: "No checkout URL returned" },
        { status: 500, headers: securityHeaders() }
      );
    }

    // 10. Validate checkout URL is HTTPS
    if (!data.checkout_url.startsWith("https://")) {
      console.error("[checkout] Invalid checkout URL scheme:", data.checkout_url);
      return NextResponse.json(
        { error: "Invalid checkout URL" },
        { status: 500, headers: securityHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: true,
        checkoutUrl: data.checkout_url,
        checkoutId: data.id,
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error("[checkout] Unhandled error:", error);
    return NextResponse.json(
      { error: "Payment initialization failed" },
      { status: 500, headers: securityHeaders() }
    );
  }
}
