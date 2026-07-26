import { NextResponse } from "next/server";

// ─── PayPal Diagnostic Endpoint ───────────────────────────────────────────
// Tests both sandbox and live PayPal endpoints with the configured credentials
// to identify which environment they belong to.
//
// This endpoint is read-only and exposes only safe diagnostic info (no secrets).
// Usage: GET /api/paypal/diagnose

const SANDBOX_URL = "https://api-m.sandbox.paypal.com";
const LIVE_URL = "https://api-m.paypal.com";

interface EndpointTest {
  env: "sandbox" | "live";
  baseUrl: string;
  status: number | "network_error";
  ok: boolean;
  responsePreview?: string;
  durationMs: number;
}

async function testEndpoint(
  env: "sandbox" | "live",
  clientId: string,
  clientSecret: string
): Promise<EndpointTest> {
  const baseUrl = env === "live" ? LIVE_URL : SANDBOX_URL;
  const start = Date.now();
  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10000),
    });

    const text = await res.text();
    const durationMs = Date.now() - start;

    return {
      env,
      baseUrl,
      status: res.status,
      ok: res.ok,
      responsePreview: text.slice(0, 200),
      durationMs,
    };
  } catch (err) {
    return {
      env,
      baseUrl,
      status: "network_error",
      ok: false,
      responsePreview: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

export async function GET() {
  const clientId = process.env.PAYPAL_CLIENT_ID || "";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
  const configuredMode = (process.env.PAYPAL_MODE || "sandbox") as string;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID || "";
  const productId = process.env.PAYPAL_PRODUCT_ID || "";
  const monthlyPlanId = process.env.PAYPAL_MONTHLY_PLAN_ID || "";
  const annualPlanId = process.env.PAYPAL_ANNUAL_PLAN_ID || "";

  // Check if credentials are placeholders
  const placeholders = [
    "YOUR_PAYPAL_SANDBOX_CLIENT_ID",
    "YOUR_PAYPAL_SANDBOX_CLIENT_SECRET",
    "YOUR_PAYPAL_LIVE_CLIENT_ID",
    "YOUR_PAYPAL_LIVE_CLIENT_SECRET",
    "YOUR_PAYPAL_CLIENT_ID",
    "YOUR_PAYPAL_CLIENT_SECRET",
  ];
  const isPlaceholder =
    !clientId ||
    !clientSecret ||
    placeholders.includes(clientId) ||
    placeholders.includes(clientSecret);

  if (isPlaceholder) {
    return NextResponse.json(
      {
        configured: false,
        error: "PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing or is still a placeholder",
        hint: "Add real PayPal credentials in Vercel → Settings → Environment Variables",
        configuredMode,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Test BOTH endpoints in parallel to identify which one the credentials work with
  const [sandboxResult, liveResult] = await Promise.all([
    testEndpoint("sandbox", clientId, clientSecret),
    testEndpoint("live", clientId, clientSecret),
  ]);

  // Determine the correct environment
  let correctEnv: "sandbox" | "live" | "neither" | "both" = "neither";
  if (sandboxResult.ok && !liveResult.ok) correctEnv = "sandbox";
  else if (liveResult.ok && !sandboxResult.ok) correctEnv = "live";
  else if (sandboxResult.ok && liveResult.ok) correctEnv = "both";

  const modeMatchesCredentials =
    (correctEnv === "sandbox" && configuredMode === "sandbox") ||
    (correctEnv === "live" && configuredMode === "live") ||
    correctEnv === "both";

  return NextResponse.json(
    {
      configured: true,
      timestamp: new Date().toISOString(),

      // What is currently configured
      configuredMode,
      clientIdPrefix: clientId.slice(0, 8) + "...",
      clientIdSuffix: "..." + clientId.slice(-6),
      clientIdLength: clientId.length,
      secretLength: clientSecret.length,

      // Other config
      webhookIdPrefix: webhookId ? webhookId.slice(0, 4) + "..." : "(not set)",
      webhookIdLength: webhookId.length,
      hasProductId: !!productId,
      hasMonthlyPlanId: !!monthlyPlanId,
      hasAnnualPlanId: !!annualPlanId,

      // Test results
      tests: {
        sandbox: sandboxResult,
        live: liveResult,
      },

      // Diagnosis
      correctEnv,
      modeMatchesCredentials,

      // Recommendation
      recommendation:
        correctEnv === "neither"
          ? "❌ Credentials are invalid in BOTH sandbox and live. Re-copy them from PayPal dashboard."
          : !modeMatchesCredentials
          ? `⚠️ Credentials are valid for ${correctEnv.toUpperCase()} but PAYPAL_MODE is "${configuredMode}". Change PAYPAL_MODE to "${correctEnv}" in Vercel.`
          : `✅ All good! Credentials work with PAYPAL_MODE="${configuredMode}".`,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
