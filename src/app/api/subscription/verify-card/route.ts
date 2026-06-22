import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPayPalOrder } from "@/lib/paypal";

// ─── Rate limiting (in-memory, per-user) ──────────────────────────────────
const verifyAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_VERIFY_ATTEMPTS = 3;
const VERIFY_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = verifyAttempts.get(userId);

  if (!record || now > record.resetAt) {
    verifyAttempts.set(userId, { count: 1, resetAt: now + VERIFY_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_VERIFY_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of verifyAttempts) {
    if (now > val.resetAt) verifyAttempts.delete(key);
  }
}, 300_000);

// ─── Input validation ──────────────────────────────────────────────────────
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

// ─── POST handler: Create PayPal card verification order ($0.01) ──────
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: securityHeaders() }
      );
    }

    const { userId } = body as Record<string, unknown>;

    // Validate userId
    if (!userId || typeof userId !== "string" || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Rate limiting
    if (!checkRateLimit(userId)) {
      console.warn(`[verify-card] Rate limited for user: ${userId}`);
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429, headers: securityHeaders() }
      );
    }

    // Check user exists
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, hasCardOnFile: true, subscriptionStatus: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: securityHeaders() }
      );
    }

    // Already has card on file or is subscribed — no need to verify
    if (user.hasCardOnFile || user.subscriptionStatus === "active") {
      return NextResponse.json(
        { error: "Card already on file" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Create payment request record
    const paymentRequest = await db.paymentRequest.create({
      data: {
        userId,
        plan: "card_verify",
        amount: 1, // $0.01 in cents
        currency: "USD",
        status: "pending",
        txRef: `card_verify_${Date.now()}`,
      },
    });

    // Create PayPal order for $0.01
    const paypalResult = await createPayPalOrder({
      plan: "card_verify",
      userId,
      userEmail: user.email || undefined,
      requestId: paymentRequest.id,
    });

    // Update payment request with PayPal order ID
    await db.paymentRequest.update({
      where: { id: paymentRequest.id },
      data: { txRef: paypalResult.orderId },
    });

    console.log("[verify-card] PayPal order created:", {
      orderId: paypalResult.orderId,
      requestId: paymentRequest.id,
      userId: userId.slice(0, 8) + "...",
    });

    return NextResponse.json(
      {
        success: true,
        orderId: paypalResult.orderId,
        approveUrl: paypalResult.approveUrl,
        requestId: paymentRequest.id,
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error("[verify-card] Unhandled error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Card verification failed", details: errMsg },
      { status: 500, headers: securityHeaders() }
    );
  }
}
