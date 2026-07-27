import { NextResponse } from "next/server";

// ─── PayPal Diagnostic Endpoint ───────────────────────────────────────────
// Tests PayPal credentials AND validates plan IDs.
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

interface PlanCheckResult {
  id: string;
  valid: boolean;
  status?: string;
  price?: string;
  interval?: string;
  error?: string;
}

async function checkPlan(
  baseUrl: string,
  accessToken: string,
  planId: string
): Promise<PlanCheckResult> {
  try {
    const res = await fetch(`${baseUrl}/v1/billing/plans/${planId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text();
      let hint = `HTTP ${res.status}`;
      if (res.status === 404) hint = "Plan not found — wrong ID or belongs to different PayPal account";
      else if (res.status === 401) hint = "Auth failed — credentials mismatch";
      return { id: planId, valid: false, error: hint, status: `HTTP ${res.status}` };
    }

    const plan = (await res.json()) as {
      id: string;
      status: string;
      billing_cycles?: Array<{
        pricing_scheme?: { fixed_price?: { value?: string; currency_code?: string } };
        frequency?: { interval_unit?: string; interval_count?: number };
      }>;
    };

    const cycle = plan.billing_cycles?.[0];
    return {
      id: planId,
      valid: plan.status === "ACTIVE",
      status: plan.status,
      price: cycle?.pricing_scheme?.fixed_price
        ? `${cycle.pricing_scheme.fixed_price.currency_code} ${cycle.pricing_scheme.fixed_price.value}`
        : undefined,
      interval: cycle?.frequency
        ? `${cycle.frequency.interval_count} ${cycle.frequency.interval_unit?.toLowerCase()}`
        : undefined,
    };
  } catch (err) {
    return {
      id: planId,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
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

  // Now also validate plan IDs (using the working endpoint)
  let planChecks: Record<string, PlanCheckResult> = {};
  let accessToken = "";

  const workingUrl = correctEnv === "live" ? LIVE_URL : SANDBOX_URL;
  if (sandboxResult.ok || liveResult.ok) {
    try {
      const tokenRes = await fetch(`${workingUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(10000),
      });
      if (tokenRes.ok) {
        const tokenData = (await tokenRes.json()) as { access_token: string };
        accessToken = tokenData.access_token;

        // Check both plans in parallel
        const [monthlyCheck, annualCheck] = await Promise.all([
          monthlyPlanId && !monthlyPlanId.startsWith("YOUR_")
            ? checkPlan(workingUrl, accessToken, monthlyPlanId)
            : Promise.resolve({ id: monthlyPlanId || "(not set)", valid: false, error: "Not configured" }),
          annualPlanId && !annualPlanId.startsWith("YOUR_")
            ? checkPlan(workingUrl, accessToken, annualPlanId)
            : Promise.resolve({ id: annualPlanId || "(not set)", valid: false, error: "Not configured" }),
        ]);

        planChecks = { monthly: monthlyCheck, annual: annualCheck };
      }
    } catch {
      // Plan check failed — not critical
    }
  }

  // Build overall assessment
  const plansOk = planChecks.monthly?.valid && planChecks.annual?.valid;
  const monthlyOk = planChecks.monthly?.valid;
  const annualOk = planChecks.annual?.valid;

  let recommendation: string;
  if (!modeMatchesCredentials) {
    recommendation = `⚠️ Credentials are valid for ${correctEnv.toUpperCase()} but PAYPAL_MODE is "${configuredMode}". Change PAYPAL_MODE to "${correctEnv}" in Vercel.`;
  } else if (!plansOk && monthlyOk && !annualOk) {
    recommendation = `❌ Annual plan is invalid! The PAYPAL_ANNUAL_PLAN_ID on Vercel is wrong or belongs to a different account. Current value: ${annualPlanId}`;
  } else if (!plansOk && !monthlyOk && annualOk) {
    recommendation = `❌ Monthly plan is invalid! The PAYPAL_MONTHLY_PLAN_ID on Vercel is wrong.`;
  } else if (!plansOk) {
    recommendation = `❌ Plan IDs are invalid. They may belong to a different PayPal account than the configured credentials.`;
  } else {
    recommendation = `✅ All good! Credentials and both plan IDs are valid.`;
  }

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
      monthlyPlanId,
      annualPlanId,

      // Test results
      tests: {
        sandbox: sandboxResult,
        live: liveResult,
      },

      // Plan validation
      plans: planChecks,

      // Diagnosis
      correctEnv,
      modeMatchesCredentials,

      // Recommendation
      recommendation,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
