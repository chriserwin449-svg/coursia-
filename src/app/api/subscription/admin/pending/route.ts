import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as crypto from "crypto";

// ─── Admin authentication ───────────────────────────────────────────────
function isAdmin(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error("[admin] ADMIN_SECRET not configured");
    return false;
  }
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  // Constant-time comparison
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

// ─── Main handler: list pending payment requests ─────────────────────────
export async function GET(request: NextRequest) {
  try {
    // 1. Admin auth check
    if (!isAdmin(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: securityHeaders() }
      );
    }

    // 2. Query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending,pending_verification";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    // 3. Fetch payment requests
    const requests = await db.paymentRequest.findMany({
      where: {
        status: { in: status.split(",") },
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            subscriptionStatus: true,
            subscriptionPlan: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // 4. Count totals
    const totalPending = await db.paymentRequest.count({
      where: { status: "pending" },
    });
    const totalVerification = await db.paymentRequest.count({
      where: { status: "pending_verification" },
    });

    return NextResponse.json(
      {
        success: true,
        requests,
        counts: {
          pending: totalPending,
          pending_verification: totalVerification,
        },
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error("[admin-pending] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending requests" },
      { status: 500, headers: securityHeaders() }
    );
  }
}
