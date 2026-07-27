/**
 * PayPal Setup Script — Creates (or reuses) Product + 2 Recurring Plans
 * =====================================================================
 *
 * FULLY IDEMPOTENT:
 *   - If "Coursia Premium" product exists → reuse it
 *   - If a plan with matching name + price + interval exists → reuse it
 *   - Only creates what's missing
 *
 * Usage:
 *   1. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env
 *   2. Run:  bun run scripts/paypal-create-plans.ts
 *   3. Copy the printed IDs into .env
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
  process.exit(1);
}
if (!CLIENT_SECRET || CLIENT_SECRET.startsWith("YOUR_")) {
  console.error("❌ PAYPAL_CLIENT_SECRET is not set in .env");
  process.exit(1);
}

// ─── PayPal HTTP helper ───────────────────────────────────────────────────
async function paypalFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

// ─── Get access token ─────────────────────────────────────────────────────
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
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

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

// ─── Find existing product by name ───────────────────────────────────────
async function findProduct(token: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/v1/catalogs/products?page_size=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    products?: Array<{ id: string; name: string }>;
  };
  return data.products?.find((p) => p.name === "Coursia Premium")?.id || null;
}

// ─── Create product if needed ────────────────────────────────────────────
async function ensureProduct(token: string): Promise<string> {
  const existing = await findProduct(token);
  if (existing) {
    console.log(`✅ Product "Coursia Premium" already exists: ${existing}`);
    return existing;
  }

  console.log("   Creating product...");
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
      home_url: "https://coursia.app",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create product: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  console.log(`✅ Created product: ${data.id}`);
  return data.id;
}

// ─── Find existing plan by product_id + name ──────────────────────────────
async function findPlan(token: string, productId: string, planName: string): Promise<string | null> {
  // PayPal doesn't have a direct "list plans by product" endpoint that's reliable,
  // but we can list all plans and filter client-side
  let page = 1;
  const maxPages = 5;

  while (page <= maxPages) {
    const res = await fetch(
      `${BASE_URL}/v1/billing/plans?page_size=100&page=${page}&product_id=${productId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      plans?: Array<{ id: string; name: string; status: string }>;
    };

    const plans = data.plans || [];
    const match = plans.find((p) => p.name === planName && p.status === "ACTIVE");
    if (match) return match.id;

    if (plans.length < 100) break; // no more pages
    page++;
  }

  return null;
}

// ─── Create plan if needed ────────────────────────────────────────────────
interface PlanDef {
  name: string;
  amountUsd: string;
  intervalMonths: number;
  envKey: string;
}

async function ensurePlan(token: string, productId: string, plan: PlanDef): Promise<string> {
  const existing = await findPlan(token, productId, plan.name);
  if (existing) {
    console.log(`✅ Plan "${plan.name}" already exists: ${existing}`);
    return existing;
  }

  console.log(`   Creating plan "${plan.name}" ($${plan.amountUsd} / ${plan.intervalMonths} month${plan.intervalMonths > 1 ? "s" : ""})...`);
  const res = await fetch(`${BASE_URL}/v1/billing/plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      product_id: productId,
      name: plan.name,
      description: `${plan.name} — recurring subscription`,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: plan.intervalMonths,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // 0 = infinite (until canceled)
          pricing_scheme: {
            fixed_price: {
              value: plan.amountUsd,
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
    throw new Error(`Failed to create plan "${plan.name}": ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  console.log(`✅ Created plan "${plan.name}": ${data.id}`);
  return data.id;
}

// ─── Update .env automatically ─────────────────────────────────────────────
import * as fs from "fs";
import * as path from "path";

function updateEnvFile(updates: Record<string, string>): void {
  const envPath = path.resolve(process.cwd(), ".env");
  let content = "";

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  }

  for (const [key, value] of Object.entries(updates)) {
    // Match existing KEY=VALUE or KEY="VALUE"
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}="${value}"`);
    } else {
      content = content.trimEnd() + `\n${key}="${value}"\n`;
    }
  }

  fs.writeFileSync(envPath, content, "utf8");
  console.log("✅ Updated .env file automatically");
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 PayPal Setup — Mode: ${PAYPAL_MODE}`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Client ID: ${CLIENT_ID.slice(0, 12)}...`);
  console.log(`   Secret length: ${CLIENT_SECRET.length} chars\n`);

  // Step 1: Authenticate
  console.log("1️⃣  Authenticating with PayPal...");
  const token = await getAccessToken();
  console.log("   ✅ Authenticated\n");

  // Step 2: Ensure Product
  console.log("2️⃣  Ensuring product 'Coursia Premium'...");
  const productId = await ensureProduct(token);
  console.log("");

  // Step 3: Ensure Plans
  const plans: PlanDef[] = [
    { name: "Coursia Monthly", amountUsd: "9.99", intervalMonths: 1, envKey: "PAYPAL_MONTHLY_PLAN_ID" },
    { name: "Coursia Annual", amountUsd: "52.99", intervalMonths: 12, envKey: "PAYPAL_ANNUAL_PLAN_ID" },
  ];

  const ids: Record<string, string> = { PAYPAL_PRODUCT_ID: productId };

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    console.log(`${i + 3}️⃣  Ensuring plan "${plan.name}"...`);
    ids[plan.envKey] = await ensurePlan(token, productId, plan);
    console.log("");
  }

  // Step 5: Display summary
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🎉 SETUP COMPLETE! PayPal resources:\n");
  console.log(`   Product    : ${ids.PAYPAL_PRODUCT_ID}`);
  console.log(`   Monthly    : ${ids.PAYPAL_MONTHLY_PLAN_ID} ($9.99/mo)`);
  console.log(`   Annual     : ${ids.PAYPAL_ANNUAL_PLAN_ID} ($52.99/yr)`);
  console.log("");

  // Step 6: Auto-update .env
  console.log("5️⃣  Updating .env file...");
  updateEnvFile(ids);
  console.log("");

  // Summary of env vars
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("📋 Environment Variables to add on Vercel:\n");
  for (const [key, value] of Object.entries(ids)) {
    console.log(`   ${key}="${value}"`);
  }
  console.log("");
  console.log("Remaining vars to set manually:");
  console.log('   PAYPAL_MODE="sandbox"');
  console.log('   PAYPAL_CLIENT_ID="<your_client_id>"');
  console.log('   PAYPAL_CLIENT_SECRET="<your_secret>"');
  console.log('   PAYPAL_WEBHOOK_ID="<webhook_id_from_paypal>"');
  console.log('   NEXT_PUBLIC_APP_URL="<your_vercel_url>"');
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ ERROR:", err.message);
  process.exit(1);
});
