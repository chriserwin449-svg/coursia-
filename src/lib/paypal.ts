import * as crypto from "crypto";

// ─── PayPal Configuration ──────────────────────────────────────────────────

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: "sandbox" | "live";
  webhookId: string;
}

/** Placeholder values that indicate PayPal is not yet configured */
const PLACEHOLDER_IDS = [
  "YOUR_PAYPAL_SANDBOX_CLIENT_ID",
  "YOUR_PAYPAL_LIVE_CLIENT_ID",
  "YOUR_PAYPAL_CLIENT_ID",
];
const PLACEHOLDER_SECRETS = [
  "YOUR_PAYPAL_SANDBOX_CLIENT_SECRET",
  "YOUR_PAYPAL_LIVE_CLIENT_SECRET",
  "YOUR_PAYPAL_CLIENT_SECRET",
];
const PLACEHOLDER_WEBHOOKS = [
  "YOUR_PAYPAL_SANDBOX_WEBHOOK_ID",
  "YOUR_PAYPAL_LIVE_WEBHOOK_ID",
  "YOUR_PAYPAL_WEBHOOK_ID",
];

function isPlaceholder(value: string | undefined, placeholders: string[]): boolean {
  if (!value) return true;
  return placeholders.some((p) => value === p);
}

export function getPayPalConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = (process.env.PAYPAL_MODE || "sandbox") as "sandbox" | "live";
  const webhookId = process.env.PAYPAL_WEBHOOK_ID || "";

  if (isPlaceholder(clientId, PLACEHOLDER_IDS)) {
    throw new Error("PAYPAL_CLIENT_ID is not configured");
  }
  if (isPlaceholder(clientSecret, PLACEHOLDER_SECRETS)) {
    throw new Error("PAYPAL_CLIENT_SECRET is not configured");
  }

  return { clientId, clientSecret, mode, webhookId };
}

/** Returns true if PayPal is configured in LIVE mode */
export function isPayPalLive(): boolean {
  try {
    const { mode } = getPayPalConfig();
    return mode === "live";
  } catch {
    return false;
  }
}

// ─── Base URLs ─────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const { mode } = getPayPalConfig();
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

// ─── Access Token Management ────────────────────────────────────────────────

let accessTokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (accessTokenCache && Date.now() < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }

  const { clientId, clientSecret } = getPayPalConfig();
  const base64 = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${base64}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[paypal] Token request failed:", response.status, errorText);
    throw new Error(`PayPal token request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  // Cache token with 10% buffer before expiry
  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

// ─── Create Order (checkout) ───────────────────────────────────────────────

export interface CreateOrderParams {
  plan: "monthly" | "annual" | "card_verify";
  userId: string;
  userEmail?: string;
  requestId: string;
  locale?: string;
}

export interface CreateOrderResult {
  orderId: string;
  approveUrl?: string;
}

const PLAN_CONFIG = {
  monthly: { amount: "9.99", currency: "USD", description: "Coursia Monthly Plan" },
  annual: { amount: "42.99", currency: "USD", description: "Coursia Annual Plan" },
  card_verify: { amount: "0.01", currency: "USD", description: "Coursia Card Verification" },
} as const;

export async function createPayPalOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const config = PLAN_CONFIG[params.plan];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coursia-8oi4.vercel.app";

  const token = await getAccessToken();

  const response = await fetch(`${getBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "PayPal-Request-Id": params.requestId,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.requestId,
          custom_id: JSON.stringify({
            userId: params.userId,
            plan: params.plan,
            requestId: params.requestId,
          }),
          amount: {
            currency_code: config.currency,
            value: config.amount,
            breakdown: {
              item_total: {
                currency_code: config.currency,
                value: config.amount,
              },
            },
          },
          items: [
            {
              name: config.description,
              unit_amount: {
                currency_code: config.currency,
                value: config.amount,
              },
              quantity: "1",
              category: "DIGITAL_GOODS",
            },
          ],
          description: config.description,
        },
      ],
      application_context: {
        brand_name: "Coursia",
        locale: params.locale || "fr_FR",
        user_action: "PAY_NOW",
        landing_page: "BILLING",
        shipping_preference: "NO_SHIPPING",
        return_url: params.plan === "card_verify"
          ? `${appUrl}/?card_verified=success&request_id=${encodeURIComponent(params.requestId)}`
          : `${appUrl}/?payment=success&plan=${params.plan}&request_id=${encodeURIComponent(params.requestId)}`,
        cancel_url: `${appUrl}/?payment=cancelled&plan=${params.plan}`,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[paypal] Create order failed:", response.status, errorText);
    // Classify error for better frontend handling
    let errorType = "PAYPAL_ORDER_FAILED";
    let userMessage = `PayPal order creation failed: ${response.status}`;
    if (response.status === 401) {
      errorType = "PAYPAL_AUTH";
      userMessage = "PayPal authentication failed. Check API credentials.";
    } else if (response.status === 422) {
      errorType = "PAYPAL_VALIDATION";
      userMessage = "PayPal order validation failed. Check order details.";
    }
    const err = new Error(userMessage) as Error & { code: string };
    err.code = errorType;
    throw err;
  }

  const data = (await response.json()) as {
    id: string;
    status: string;
    links: Array<{ href: string; rel: string }>;
  };

  const approveLink = data.links.find((l) => l.rel === "approve");

  return {
    orderId: data.id,
    approveUrl: approveLink?.href,
  };
}

// ─── Capture Order (after user approves) ──────────────────────────────────

export interface CaptureResult {
  orderId: string;
  status: "COMPLETED" | "PENDING" | "DECLINED" | string;
  payerEmail?: string;
  payerName?: string;
  amount?: string;
  currency?: string;
  customData?: { userId: string; plan: string; requestId: string };
}

export async function capturePayPalOrder(orderId: string): Promise<CaptureResult> {
  const token = await getAccessToken();

  const response = await fetch(`${getBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[paypal] Capture order failed:", response.status, errorText);
    // Classify capture errors for frontend
    let errorType = "PAYPAL_CAPTURE_FAILED";
    let userMessage = `PayPal capture failed: ${response.status}`;
    if (response.status === 422) {
      errorType = "PAYPAL_ALREADY_CAPTURED";
      userMessage = "This payment has already been captured.";
    } else if (response.status === 404) {
      errorType = "PAYPAL_ORDER_NOT_FOUND";
      userMessage = "PayPal order not found. It may have expired.";
    } else if (response.status === 400) {
      errorType = "PAYPAL_INVALID_REQUEST";
      userMessage = "Invalid PayPal capture request.";
    }
    const err = new Error(userMessage) as Error & { code: string };
    err.code = errorType;
    throw err;
  }

  const data = (await response.json()) as {
    id: string;
    status: string;
    purchase_units: Array<{
      payments: {
        captures: Array<{
          amount: { currency_code: string; value: string };
        }>;
      };
      amount: { currency_code: string; value: string };
      custom_id?: string;
      reference_id?: string;
    }>;
    payer: {
      email_address?: string;
      name?: { given_name?: string; surname?: string };
    };
  };

  const purchaseUnit = data.purchase_units[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  let customData: CaptureResult["customData"];
  try {
    if (purchaseUnit?.custom_id) {
      customData = JSON.parse(purchaseUnit.custom_id);
    }
  } catch {
    // ignore parse errors
  }

  return {
    orderId: data.id,
    status: data.status,
    payerEmail: data.payer?.email_address,
    payerName: data.payer?.name
      ? `${data.payer.name.given_name || ""} ${data.payer.name.surname || ""}`.trim()
      : undefined,
    amount: capture?.amount?.value || purchaseUnit?.amount?.value,
    currency: capture?.amount?.currency_code || purchaseUnit?.amount?.currency_code,
    customData,
  };
}

// ─── Webhook Verification ───────────────────────────────────────────────────

export interface WebhookEvent {
  event_type: string;
  resource: {
    id: string;
    status?: string;
    custom_id?: string;
    purchase_units?: Array<{ custom_id?: string; reference_id?: string }>;
    amount?: { currency_code: string; value: string };
    payer?: { email_address?: string };
  };
  id: string;
  create_time: string;
}

export async function verifyWebhookSignature(
  body: string,
  headers: Record<string, string>
): Promise<boolean> {
  try {
    const { webhookId, mode } = getPayPalConfig();

    // In live mode, webhook ID is MANDATORY — refuse unverified webhooks
    if (!webhookId || isPlaceholder(webhookId, PLACEHOLDER_WEBHOOKS)) {
      if (mode === "live") {
        console.error("[paypal] LIVE MODE: Webhook ID is not configured — REJECTING webhook");
        return false;
      }
      // Sandbox: allow without webhook ID for testing
      console.warn("[paypal] Sandbox mode — skipping signature verification (no webhook ID)");
      return true;
    }

    const token = await getAccessToken();

    // Parse transmission headers
    const transmissionId = headers["paypal-transmission-id"] || "";
    const transmissionTime = headers["paypal-transmission-time"] || "";
    const certUrl = headers["paypal-cert-url"] || "";
    const authAlgo = headers["paypal-auth-algo"] || "";
    const transmissionSig = headers["paypal-transmission-sig"] || "";

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      console.warn("[paypal] Missing webhook signature headers");
      return false;
    }

    const response = await fetch(`${getBaseUrl()}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    });

    if (!response.ok) {
      console.error("[paypal] Webhook verification request failed:", response.status);
      return false;
    }

    const result = (await response.json()) as { verification_status: string };
    return result.verification_status === "SUCCESS";
  } catch (error) {
    console.error("[paypal] Webhook verification error:", error);
    return false;
  }
}

// ─── Utility: Get frontend client ID ───────────────────────────────────────

export function getClientId(): string {
  return process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || "";
}

// ─── Utility: Get PayPal mode for frontend ──────────────────────────────────

export function getPayPalMode(): "sandbox" | "live" {
  return (process.env.PAYPAL_MODE || "sandbox") as "sandbox" | "live";
}
