/**
 * PayPal Webhook Creator — Creates a webhook for subscription events
 * =================================================================
 *
 * Creates a PayPal webhook that sends events to your Vercel URL.
 * Works in both sandbox and live mode.
 *
 * Usage:
 *   PAYPAL_MODE=live \
 *   PAYPAL_CLIENT_ID=xxx \
 *   PAYPAL_CLIENT_SECRET=xxx \
 *   PAYPAL_WEBHOOK_URL=https://your-vercel-url.vercel.app/api/subscription/webhook \
 *   bun run scripts/paypal-create-webhook.ts
 */

const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox";
const BASE_URL =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const WEBHOOK_URL = process.env.PAYPAL_WEBHOOK_URL;

if (!CLIENT_ID || CLIENT_ID.startsWith("YOUR_")) {
  console.error("❌ PAYPAL_CLIENT_ID is not set");
  process.exit(1);
}
if (!CLIENT_SECRET || CLIENT_SECRET.startsWith("YOUR_")) {
  console.error("❌ PAYPAL_CLIENT_SECRET is not set");
  process.exit(1);
}
if (!WEBHOOK_URL || !WEBHOOK_URL.startsWith("https://")) {
  console.error("❌ PAYPAL_WEBHOOK_URL must be a full HTTPS URL");
  console.error('   Example: PAYPAL_WEBHOOK_URL="https://coursia.vercel.app/api/subscription/webhook"');
  process.exit(1);
}

// Subscription lifecycle events we need
const WEBHOOK_EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.DENIED",
];

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

async function listExistingWebhooks(token: string): Promise<Array<{ id: string; url: string; event_types: Array<{ name: string }> }>> {
  const res = await fetch(`${BASE_URL}/v1/notifications/webhooks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { webhooks?: Array<{ id: string; url: string; event_types: Array<{ name: string }> }> };
  return data.webhooks || [];
}

async function main() {
  console.log(`\n🪝 PayPal Webhook Creator — Mode: ${PAYPAL_MODE.toUpperCase()}`);
  console.log(`   Webhook URL: ${WEBHOOK_URL}\n`);

  // 1. Authenticate
  console.log("1️⃣  Authenticating...");
  const token = await getAccessToken();
  console.log("   ✅ Authenticated\n");

  // 2. Check for existing webhook with same URL
  console.log("2️⃣  Checking for existing webhook...");
  const existing = await listExistingWebhooks(token);
  const match = existing.find((w) => w.url === WEBHOOK_URL);

  if (match) {
    console.log(`✅ Webhook already exists for this URL: ${match.id}`);
    console.log(`   Events: ${match.event_types.map((e) => e.name).join(", ")}`);
    console.log(`\n📋 Webhook ID to add to Vercel:`);
    console.log(`   PAYPAL_WEBHOOK_ID="${match.id}"`);
    return;
  }
  console.log("   No existing webhook found for this URL.\n");

  // 3. Create webhook
  console.log("3️⃣  Creating webhook...");
  const res = await fetch(`${BASE_URL}/v1/notifications/webhooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      event_types: WEBHOOK_EVENTS.map((name) => ({ name })),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create webhook: ${res.status} ${text}`);
  }

  const webhook = (await res.json()) as { id: string; url: string };
  console.log(`✅ Webhook created!`);
  console.log(`   ID: ${webhook.id}`);
  console.log(`   URL: ${webhook.url}`);
  console.log(`   Events: ${WEBHOOK_EVENTS.join(", ")}\n`);

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("📋 Add this to Vercel Environment Variables:\n");
  console.log(`   PAYPAL_WEBHOOK_ID="${webhook.id}"`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ ERROR:", err.message);
  process.exit(1);
});
