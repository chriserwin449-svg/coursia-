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

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of checkoutAttempts) {
    if (now > val.resetAt) checkoutAttempts.delete(key);
  }
}, 300_000);

// ─── Price configuration (server-side, tamper-proof) ────────────────────
const PLAN_CONFIG = {
  monthly: { amount: 999, currency: "USD" },   // $9.99
  annual: { amount: 2899, currency: "USD" },    // $28.99
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

// ─── Transaction reference generation ────────────────────────────────────
function generateTxRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `CRS-${timestamp}-${random}`;
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

    // 5. Check Flutterwave API key
    const secretKey = process.env.FLW_SECRET_KEY;
    if (!secretKey) {
      console.error("[checkout] FLW_SECRET_KEY not set");
      return NextResponse.json(
        { error: "Payment not configured" },
        { status: 500, headers: securityHeaders() }
      );
    }

    // 6. Fetch user info from DB
    let customerEmail = "";
    let customerName = "";
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });
      if (user) {
        customerEmail = user.email || "";
        customerName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
      }
    } catch (dbErr) {
      console.warn("[checkout] Could not fetch user info:", dbErr);
    }

    // 7. Build Flutterwave payment request
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coursia-8oi4.vercel.app";
    const txRef = generateTxRef();
    const redirectUrl = `${appUrl}/?payment=success&plan=${plan}&tx_ref=${encodeURIComponent(txRef)}`;

    const planConfig = PLAN_CONFIG[plan];

    console.log("[checkout] Creating Flutterwave payment:", {
      plan,
      amount: planConfig.amount,
      userId: userId.slice(0, 8) + "...",
      hasEmail: !!customerEmail,
      txRef: txRef,
    });

    // 8. Call Flutterwave API
    const res = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": secretKey,
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: planConfig.amount,
        currency: planConfig.currency,
        redirect_url: redirectUrl,
        payment_options: "card,mobilemoney,ussd,bank_transfer",
        customer: customerEmail && isValidEmail(customerEmail)
          ? { email: sanitizeString(customerEmail), name: sanitizeString(customerName) || "Coursia User" }
          : { email: `${userId.slice(0, 8)}@coursia.app`, name: "Coursia User" },
        meta: {
          userId: sanitizeString(userId),
          plan: sanitizeString(plan),
          appSource: "coursia",
        },
        customizations: {
          title: plan === "annual"
            ? "Coursia Pro - Annuel"
            : "Coursia Pro - Mensuel",
          description: plan === "annual"
            ? "Abonnement annuel Coursia Pro"
            : "Abonnement mensuel Coursia Pro",
          logo: "https://coursia-8oi4.vercel.app/logo.png",
        },
      }),
    });

    const data = await res.json();

    console.log("[checkout] Flutterwave response:", {
      status: res.status,
      ok: res.ok,
      txRef: data.data?.tx_ref,
      hasLink: !!data.data?.link,
      error: data.message,
    });

    if (!res.ok || data.status !== "success") {
      return NextResponse.json(
        {
          error: data.message || "Payment initialization failed",
        },
        { status: res.status >= 500 ? 502 : 400, headers: securityHeaders() }
      );
    }

    const paymentLink = data.data?.link;
    if (!paymentLink) {
      return NextResponse.json(
        { error: "No payment link returned" },
        { status: 500, headers: securityHeaders() }
      );
    }

    // 9. Validate payment link is HTTPS
    if (!paymentLink.startsWith("https://")) {
      console.error("[checkout] Invalid payment link scheme:", paymentLink);
      return NextResponse.json(
        { error: "Invalid payment link" },
        { status: 500, headers: securityHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: true,
        checkoutUrl: paymentLink,
        checkoutId: txRef,
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
