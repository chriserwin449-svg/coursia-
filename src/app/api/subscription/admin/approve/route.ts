import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as crypto from "crypto";

// ─── Admin authentication ───────────────────────────────────────────────
function isAdmin(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  try {
    const expected = Buffer.from(adminSecret);
    const provided = Buffer.from(token);
    if (expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

// ─── Security headers ────────────────────────────────────────────────────
function securityHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

// ─── Main handler: approve payment and activate subscription ──────────────
export async function POST(request: NextRequest) {
  try {
    // 1. Admin auth
    if (!isAdmin(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: securityHeaders() }
      );
    }

    // 2. Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: securityHeaders() }
      );
    }

    const { requestId, adminNote } = body as Record<string, unknown>;

    // 3. Validate requestId
    if (!requestId || typeof requestId !== "string" || requestId.length < 5 || requestId.length > 100) {
      return NextResponse.json(
        { error: "Invalid request ID" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 4. Find payment request
    const paymentRequest = await db.paymentRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!paymentRequest) {
      return NextResponse.json(
        { error: "Payment request not found" },
        { status: 404, headers: securityHeaders() }
      );
    }

    // 5. Check status (can approve pending or pending_verification)
    if (paymentRequest.status === "approved") {
      return NextResponse.json(
        { error: "Already approved" },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 6. Mark payment as approved
    await db.paymentRequest.update({
      where: { id: requestId },
      data: {
        status: "approved",
        adminNote: adminNote ? String(adminNote).slice(0, 500) : null,
      },
    });

    // 7. Activate subscription on the user
    const plan = paymentRequest.plan === "annual" ? "annual" : "monthly";

    // Calculate subscription end date
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (plan === "annual") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    await db.user.update({
      where: { id: paymentRequest.userId },
      data: {
        subscriptionPlan: plan,
        subscriptionStatus: "active",
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        creemSubscriptionId: requestId, // Reuse column: store payment request ID
        creemCustomerId: "fondeka",
        updatedAt: new Date(),
      },
    });

    console.log("[admin-approve] Subscription activated:", {
      requestId,
      userId: paymentRequest.userId.slice(0, 8) + "...",
      email: paymentRequest.user?.email,
      plan,
      endDate: endDate.toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Subscription activated successfully",
        requestId,
        userId: paymentRequest.userId,
        plan,
        activatedAt: startDate.toISOString(),
        expiresAt: endDate.toISOString(),
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error("[admin-approve] Unhandled error:", error);
    return NextResponse.json(
      { error: "Approval failed" },
      { status: 500, headers: securityHeaders() }
    );
  }
}
