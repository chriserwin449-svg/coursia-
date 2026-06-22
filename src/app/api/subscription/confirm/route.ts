import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as crypto from "crypto";

// ─── Rate limiting ────────────────────────────────────────────────────────
const confirmAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_CONFIRM_ATTEMPTS = 5;
const CONFIRM_WINDOW_MS = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = confirmAttempts.get(key);
  if (!record || now > record.resetAt) {
    confirmAttempts.set(key, { count: 1, resetAt: now + CONFIRM_WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_CONFIRM_ATTEMPTS) return false;
  record.count++;
  return true;
}

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of confirmAttempts) {
    if (now > val.resetAt) confirmAttempts.delete(key);
  }
}, 300_000);

// ─── Input validation ──────────────────────────────────────────────────────
function isValidUserId(userId: string): boolean {
  // Accept both cuid (clxxx...) and standard UUID (xxx-xxx-xxx) formats
  const idRegex = /^[a-z0-9-]+$/;
  return userId.length > 5 && userId.length < 50 && idRegex.test(userId);
}

function sanitizeString(str: string): string {
  return str.replace(/[<>'"&;(){}[\]]/g, "").trim().slice(0, 500);
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
    // 1. Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: securityHeaders() }
      );
    }

    const { userId, requestId, txRef, paymentProof } = body as Record<string, unknown>;

    // 2. Validate userId
    if (!userId || typeof userId !== "string" || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 3. Validate requestId
    if (!requestId || typeof requestId !== "string" || requestId.length < 5 || requestId.length > 100) {
      return NextResponse.json(
        { error: "Invalid request ID" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 4. Rate limiting
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429, headers: securityHeaders() }
      );
    }

    // 5. Find the payment request
    const paymentRequest = await db.paymentRequest.findUnique({
      where: { id: requestId },
    });

    if (!paymentRequest) {
      return NextResponse.json(
        { error: "Payment request not found" },
        { status: 404, headers: securityHeaders() }
      );
    }

    // 6. Verify ownership
    if (paymentRequest.userId !== userId) {
      console.warn(`[confirm] User ${userId} tried to confirm request owned by ${paymentRequest.userId}`);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403, headers: securityHeaders() }
      );
    }

    // 7. Check current status
    if (paymentRequest.status !== "pending") {
      return NextResponse.json(
        { error: `Payment already ${paymentRequest.status}` },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 8. Update with optional proof
    const updateData: Record<string, string> = {
      status: "pending_verification",
    };

    if (txRef && typeof txRef === "string") {
      updateData.txRef = sanitizeString(txRef);
    }

    if (paymentProof && typeof paymentProof === "string") {
      updateData.paymentProof = sanitizeString(paymentProof);
    }

    await db.paymentRequest.update({
      where: { id: requestId },
      data: updateData,
    });

    console.log("[confirm] Payment request marked for verification:", {
      requestId,
      userId: userId.slice(0, 8) + "...",
      hasTxRef: !!txRef,
      hasProof: !!paymentProof,
      plan: paymentRequest.plan,
      amount: paymentRequest.amount,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Payment confirmation submitted. Your access will be activated shortly.",
        requestId,
        status: "pending_verification",
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error("[confirm] Unhandled error:", error);
    return NextResponse.json(
      { error: "Payment confirmation failed" },
      { status: 500, headers: securityHeaders() }
    );
  }
}
