/**
 * PayPal Setup Script — Creates a Product + 2 Recurring Plans (monthly + annual)
 * ===========================================================================
 *
 * Usage:
 *   1. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env (Sandbox values)
 *   2. Run:  bun run scripts/paypal-create-plans.ts
 *   3. Copy the printed IDs into .env:
 *        - PAYPAL_PRODUCT_ID
 *        - PAYPAL_MONTHLY_PLAN_ID
 *        - PAYPAL_ANNUAL_PLAN_ID
 *   4. Restart the dev server
 *
 * This script is IDEMPOTENT — if a product named "Coursia Premium" already
 * exists in your account, it will reuse it. (Plans are always recreated since
 * PayPal doesn't allow listing all plans by name.)
 */

const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox";
const BASE_URL =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

if (!CLIENT_ID || CLIENT_ID.startsWith("YOUR_")) {
  console.error("❌ PAYPAL_CLIENT_ID is not set in .env");
  console.error("   Get it from https://developer.paypal.com → Apps & Credentials → Sandbox");
  process.exit(1);
}
if (!CLIENT_SECRET || CLIENT_SECRET.startsWith("YOUR_")) {
  console.error("❌ PAYPAL_CLIENT_SECRET is not set in .env");
  console.error("   Click 'Show' next to the Secret field on the same page");
  process.exit(1);
}

// ─── Get access token ─────────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get access token: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ─── List existing products to find "Coursia Premium" if it exists ────────
async function findExistingProduct(token: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/v1/catalogs/products?page_size=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    products?: Array<{ id: string; name: string }>;
  };

  const existing = data.products?.find((p) => p.name === "Coursia Premium");
  return existing?.id || null;
}

// ─── Create the Product ───────────────────────────────────────────────────
async function createProduct(token: string): Promise<string> {
  // First try to find an existing one (idempotency)
  const existingId = await findExistingProduct(token);
  if (existingId) {
    console.log(`✅ Reusing existing product: ${existingId}`);
    return existingId;
  }

  const res = await fetch(`${BASE_URL}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "Coursia Premium",
      description: "Coursia AI-powered course generation — unlimited access",
      type: "SERVICE",
      category: "EDUCATIONAL_AND_TEXTBOOKS",
      image_url: "https://coursia.app/logo.png",
      home_url: "https://coursia.app",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create product: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  console.log(`✅ Created new product: ${data.id}`);
  return data.id;
}

// ─── Create a recurring plan ──────────────────────────────────────────────
async function createPlan(
  token: string,
  productId: string,
  name: string,
  amountUsd: string,
  intervalMonths: number
): Promise<string> {
  const intervalCount = intervalMonths;

  const res = await fetch(`${BASE_URL}/v1/billing/plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      product_id: productId,
      name,
      description: `${name} — recurring subscription`,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: intervalCount,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // 0 = infinite (until canceled)
          pricing_scheme: {
            fixed_price: {
              value: amountUsd,
              currency_code: "USD",
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 2,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create plan "${name}": ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  console.log(`✅ Created plan "${name}": ${data.id}`);
  return data.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 PayPal Setup — Mode: ${PAYPAL_MODE}\n`);
  console.log(`   Base URL: ${BASE_URL}\n`);

  console.log("1️⃣  Authenticating with PayPal...");
  const token = await getAccessToken();
  console.log("   ✅ Authenticated\n");

  console.log("2️⃣  Creating / finding product...");
  const productId = await createProduct(token);
  console.log("");

  console.log("3️⃣  Creating Monthly plan ($9.99 / 30 days)...");
  // PayPal billing uses MONTH intervals, so 30 days = 1 month
  const monthlyPlanId = await createPlan(token, productId, "Coursia Monthly", "9.99", 1);
  console.log("");

  console.log("4️⃣  Creating Annual plan ($52.99 / 12 months)...");
  const annualPlanId = await createPlan(token, productId, "Coursia Annual", "52.99", 12);
  console.log("");

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🎉 SUCCESS! Add these to your .env file:\n");
  console.log(`PAYPAL_PRODUCT_ID="${productId}"`);
  console.log(`PAYPAL_MONTHLY_PLAN_ID="${monthlyPlanId}"`);
  console.log(`PAYPAL_ANNUAL_PLAN_ID="${annualPlanId}"`);
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("Next steps:");
  console.log("  1. Paste the IDs above into your .env file");
  console.log("  2. Set up the webhook in your PayPal app:");
  console.log(`     URL: https://YOUR-DOMAIN/api/subscription/webhook`);
  console.log("     Events: BILLING.SUBSCRIPTION.ACTIVATED, PAYMENT.SALE.COMPLETED,");
  console.log("             BILLING.SUBSCRIPTION.CANCELLED, BILLING.SUBSCRIPTION.EXPIRED");
  console.log("  3. Copy the Webhook ID (starts with WH-) into PAYPAL_WEBHOOK_ID");
  console.log("  4. Restart: bun run dev\n");
}

main().catch((err) => {
  console.error("\n❌ ERROR:", err.message);
  process.exit(1);
});
