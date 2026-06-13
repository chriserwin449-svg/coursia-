import { NextResponse } from "next/server";

// ─── PayPal Public Config ──────────────────────────────────────────────────
// Returns only the client ID and mode — safe to expose to the frontend.
// PayPal client IDs are inherently public (they appear in every website's JS).

const PLACEHOLDER_IDS = [
  "YOUR_PAYPAL_SANDBOX_CLIENT_ID",
  "YOUR_PAYPAL_LIVE_CLIENT_ID",
  "YOUR_PAYPAL_CLIENT_ID",
];

export async function GET() {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID || "";
    const mode = (process.env.PAYPAL_MODE || "sandbox") as "sandbox" | "live";

    // Detect placeholder values (both sandbox and live)
    if (!clientId || PLACEHOLDER_IDS.includes(clientId)) {
      return NextResponse.json(
        { configured: false, clientId: "", mode },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        }
      );
    }

    return NextResponse.json(
      { configured: true, clientId, mode },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { configured: false, clientId: "", mode: "sandbox" },
      { status: 500 }
    );
  }
}
