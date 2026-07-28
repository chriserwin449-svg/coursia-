import { NextResponse } from "next/server";
import { getPayPalConfig } from "@/lib/paypal";

/**
 * GET /api/paypal/test-plans
 * Actually tries to create a test subscription for BOTH plans and returns
 * the exact PayPal response for each. This reveals which plan_id fails and why.
 */
export async function GET() {
  try {
    const { clientId, clientSecret, mode } = getPayPalConfig();
    const baseUrl =
      mode === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

    // Get access token
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: "Token failed", status: tokenRes.status },
        { status: 500 }
      );
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    const token = tokenData.access_token;

    const monthlyPlanId = process.env.PAYPAL_MONTHLY_PLAN_ID || "(not set)";
    const annualPlanId = process.env.PAYPAL_ANNUAL_PLAN_ID || "(not set)";

    // Test each plan by trying to create a subscription
    const results: Record<string, unknown> = {
      mode,
      configured_monthly_id: monthlyPlanId,
      configured_annual_id: annualPlanId,
      monthly: null,
      annual: null,
    };

    for (const [key, planId, label] of [
      ["monthly", monthlyPlanId, "Mensuel"],
      ["annual", annualPlanId, "Annuel"],
    ] as const) {
      if (!planId || planId.startsWith("YOUR_") || planId === "(not set)") {
        results[key] = { error: "Plan ID not configured on Vercel" };
        continue;
      }

      const testRequestId = `diag-${key}-${Date.now()}`;

      try {
        const res = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "PayPal-Request-Id": testRequestId,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            plan_id: planId,
            custom_id: JSON.stringify({ test: true, plan: key }),
            application_context: {
              brand_name: "Coursia",
              locale: "fr-FR",
              shipping_preference: "NO_SHIPPING",
              user_action: "SUBSCRIBE_NOW",
              payment_method: {
                payer_selected: "PAYPAL",
                payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
              },
              return_url: `https://coursia.app/?payment=success&plan=${key}`,
              cancel_url: `https://coursia.app/?payment=cancelled&plan=${key}`,
            },
          }),
        });

        const text = await res.text();
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          /* not JSON */
        }

        if (res.ok) {
          results[key] = {
            success: true,
            plan_id_used: planId,
            subscription_id: parsed?.id,
            status: parsed?.status,
            message: `${label} plan WORKS ✅`,
          };
        } else {
          // Extract PayPal error details
          const details = (parsed?.details as Array<Record<string, string>>) || [];
          const issue = details
            .map(
              (d) =>
                `${d.field}: ${d.issue} – ${d.description || d.value || ""}`
            )
            .join("; ");

          results[key] = {
            success: false,
            plan_id_used: planId,
            http_status: res.status,
            paypal_error: parsed?.error || parsed?.message || text.slice(0, 300),
            paypal_details: details.length > 0 ? issue : "(no details)",
            plan_id_length: planId.length,
            plan_id_chars: planId.split("").map((c) => c.charCodeAt(0)),
            message: `${label} plan FAILED ❌`,
            hint:
              details.find((d) => d.field === "/plan_id")
                ?.issue === "INVALID_PARAMETER_SYNTAX"
                ? `⚠️ The plan_id "${planId}" is rejected by PayPal. It may be wrong, corrupted, or belong to a different account. Check PAYPAL_${key.toUpperCase()}_PLAN_ID on Vercel.`
                : "",
          };
        }
      } catch (err) {
        results[key] = {
          success: false,
          error: "Exception",
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return NextResponse.json(results, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
