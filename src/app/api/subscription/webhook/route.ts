import { NextRequest, NextResponse } from "next/server";

// ─── Security headers ────────────────────────────────────────────────────
function securityHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

// ─── Webhook endpoint ─────────────────────────────────────────────────────
// Currently Fondeka does not provide webhook APIs.
// This endpoint is kept for future integration when an automated
// payment gateway with webhooks becomes available (e.g., Paddle, DPO Paygate).
//
// For now, payment confirmation is handled via:
//   POST /api/subscription/confirm  (user clicks "I paid")
//   POST /api/subscription/admin/approve  (admin approves)

export async function POST(request: NextRequest) {
  // Log webhook attempt for debugging
  const body = await request.text();
  console.log("[webhook] Received webhook payload (not processed — manual mode active):", body.slice(0, 200));

  return NextResponse.json(
    { received: true, mode: "manual" },
    { headers: securityHeaders() }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: securityHeaders() }
  );
}
