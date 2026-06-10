import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as crypto from "crypto";

// ─── Rate limiting (in-memory, per-user) ──────────────────────────────────
const checkoutAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_CHECKOUT_ATTEMPTS = 3; // per user per window
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

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of checkoutAttempts) {
    if (now > val.resetAt) checkoutAttempts.delete(key);
  }
}, 300_000);

// ─── Price configuration (server-side, tamper-proof) ────────────────────
const PLAN_CONFIG = {
  monthly: { amount: 999, currency: "USD" },   // $9.99
  annual: { amount: 4299, currency: "USD" },    // $42.99
} as const;

type PlanType = keyof typeof PLAN_CONFIG;

// ─── Input validation ──────────────────────────────────────────────────────
function isValidPlan(plan: string): plan is PlanType {
  return plan === "monthly" || plan === "annual";
}

function isValidUserId(userId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}

function sanitizeString(str: string): string {
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

    // 5. Check if user already has an active subscription
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
      },
    });

    if (user?.subscriptionStatus === "active") {
      return NextResponse.json(
        { error: "Already subscribed" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 6. Get the correct Chariow link for the plan
    const chariowLink = plan === "monthly"
      ? process.env.CHARIOW_MONTHLY_LINK
      : process.env.CHARIOW_ANNUAL_LINK;

    if (!chariowLink) {
      console.error(`[checkout] CHARIOW_${plan.toUpperCase()}_LINK not set`);
      return NextResponse.json(
        { error: "Payment not configured" },
        { status: 500, headers: securityHeaders() }
      );
    }

    // 7. Create payment request record
    const planConfig = PLAN_CONFIG[plan];
    const paymentRequest = await db.paymentRequest.create({
      data: {
        userId,
        plan,
        amount: planConfig.amount,
        currency: planConfig.currency,
        status: "pending",
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coursia-8oi4.vercel.app";
    const returnUrl = `${appUrl}/?payment=pending&plan=${plan}&request_id=${encodeURIComponent(paymentRequest.id)}`;

    console.log("[checkout] Payment request created:", {
      plan,
      amount: planConfig.amount,
      userId: userId.slice(0, 8) + "...",
      requestId: paymentRequest.id,
      returnUrl,
    });

    // 8. Return Chariow payment link + return URL
    return NextResponse.json(
      {
        success: true,
        checkoutUrl: chariowLink,
        returnUrl,
        requestId: paymentRequest.id,
        amount: planConfig.amount,
        currency: planConfig.currency,
        plan,
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