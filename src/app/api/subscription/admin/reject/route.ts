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

// ─── Main handler: reject payment ──────────────────────────────────────
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
    });

    if (!paymentRequest) {
      return NextResponse.json(
        { error: "Payment request not found" },
        { status: 404, headers: securityHeaders() }
      );
    }

    // 5. Check status
    if (paymentRequest.status === "approved" || paymentRequest.status === "rejected") {
      return NextResponse.json(
        { error: `Already ${paymentRequest.status}` },
        { status: 400, headers: securityHeaders() }
      );
    }

    // 6. Mark as rejected
    await db.paymentRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        adminNote: adminNote ? String(adminNote).slice(0, 500) : null,
      },
    });

    console.log("[admin-reject] Payment rejected:", {
      requestId,
      userId: paymentRequest.userId.slice(0, 8) + "...",
      plan: paymentRequest.plan,
      reason: adminNote || "No reason provided",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Payment rejected",
        requestId,
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error("[admin-reject] Unhandled error:", error);
    return NextResponse.json(
      { error: "Rejection failed" },
      { status: 500, headers: securityHeaders() }
    );
  }
}
