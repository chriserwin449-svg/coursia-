import { NextResponse } from "next/server";
import { getPayPalConfig } from "@/lib/paypal";

/**
 * GET /api/paypal/check-plans
 * Verifies that both PayPal billing plans exist and are ACTIVE.
 * Returns detailed plan info so we can diagnose 400 errors on specific plans.
 */
export async function GET() {
  try {
    const { clientId, clientSecret, mode } = getPayPalConfig();
    const baseUrl =
      mode === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

    // Get access token
    const base64 = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${base64}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: "Failed to get PayPal token", status: tokenRes.status },
        { status: 500 }
      );
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    const token = tokenData.access_token;

    // Check both plans
    const monthlyPlanId = process.env.PAYPAL_MONTHLY_PLAN_ID;
    const annualPlanId = process.env.PAYPAL_ANNUAL_PLAN_ID;
    const productId = process.env.PAYPAL_PRODUCT_ID;

    const results: Record<string, unknown> = {
      mode,
      productId,
      monthlyPlanId,
      annualPlanId,
      monthly: null,
      annual: null,
    };

    // Fetch each plan
    for (const [key, planId] of [
      ["monthly", monthlyPlanId],
      ["annual", annualPlanId],
    ] as const) {
      if (!planId || planId.startsWith("YOUR_")) {
        results[key] = { error: "Plan ID not configured" };
        continue;
      }

      try {
        const planRes = await fetch(
          `${baseUrl}/v1/billing/plans/${planId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!planRes.ok) {
          const errorText = await planRes.text();
          let parsedError: Record<string, unknown> | null = null;
          try {
            parsedError = JSON.parse(errorText);
          } catch { /* not JSON */ }

          results[key] = {
            error: `PayPal returned ${planRes.status}`,
            details: parsedError || errorText,
            hint:
              planRes.status === 404
                ? "Plan does not exist or belongs to a different environment (sandbox vs live)"
                : planRes.status === 401
                  ? "Authentication failed — credentials mismatch"
                  : "Unknown error",
          };
          continue;
        }

        const plan = (await planRes.json()) as Record<string, unknown>;
        const billingCycles = plan.billing_cycles as Array<Record<string, unknown>> | undefined;
        const priceInfo = billingCycles?.map((cycle) => {
          const pricing = cycle.pricing_scheme as Record<string, unknown> | undefined;
          const fixedPrice = pricing?.fixed_price as Record<string, unknown> | undefined;
          return {
            sequence: cycle.sequence,
            tenure_type: cycle.tenure_type,
            total_cycles: cycle.total_cycles,
            frequency: cycle.frequency,
            price: fixedPrice?.value,
            currency: fixedPrice?.currency_code,
          };
        });

        results[key] = {
          id: plan.id,
          status: plan.status,
          name: plan.name,
          product_id: plan.product_id,
          pricing_cycles: priceInfo,
          create_time: plan.create_time,
          // Check if plan is active
          isActive: plan.status === "ACTIVE",
          matchesProduct: plan.product_id === productId,
        };
      } catch (err) {
        results[key] = {
          error: "Exception checking plan",
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to check plans",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
