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
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
    const mode = (process.env.PAYPAL_MODE || "sandbox") as "sandbox" | "live";
    const monthlyPlanId = process.env.PAYPAL_MONTHLY_PLAN_ID || "";
    const annualPlanId = process.env.PAYPAL_ANNUAL_PLAN_ID || "";

    const PLACEHOLDER_SECRETS = [
      "YOUR_PAYPAL_SANDBOX_CLIENT_SECRET",
      "YOUR_PAYPAL_LIVE_CLIENT_SECRET",
      "YOUR_PAYPAL_CLIENT_SECRET",
    ];

    // Detailed diagnostic: what's missing?
    const missing: string[] = [];
    if (!clientId || PLACEHOLDER_IDS.includes(clientId)) missing.push("PAYPAL_CLIENT_ID");
    if (!clientSecret || PLACEHOLDER_SECRETS.includes(clientSecret)) missing.push("PAYPAL_CLIENT_SECRET");
    if (!monthlyPlanId || monthlyPlanId.startsWith("YOUR_")) missing.push("PAYPAL_MONTHLY_PLAN_ID");
    if (!annualPlanId || annualPlanId.startsWith("YOUR_")) missing.push("PAYPAL_ANNUAL_PLAN_ID");

    if (missing.length > 0) {
      return NextResponse.json(
        { configured: false, clientId: "", mode, missing },
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
          "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { configured: false, clientId: "", mode: "sandbox", missing: ["unknown"] },
      { status: 500 }
    );
  }
}
