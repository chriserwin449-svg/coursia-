---
Task ID: 1
Agent: Main Agent
Task: Integrate PayPal Business payment system into Coursia (sandbox mode)

Work Log:
- Installed @paypal/react-paypal-js v10.0.0
- Created .env with PayPal sandbox config variables (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_MODE, NEXT_PUBLIC_PAYPAL_CLIENT_ID)
- Created src/lib/paypal.ts — full PayPal backend helper with:
  - Access token management with caching
  - createPayPalOrder() — creates checkout orders via PayPal REST API v2
  - capturePayPalOrder() — captures approved payments
  - verifyWebhookSignature() — verifies webhook signatures
  - Configuration helpers (getClientId, getPayPalMode)
- Rewrote src/app/api/subscription/checkout/route.ts — now creates PayPal orders instead of Chariow links
- Created src/app/api/subscription/capture/route.ts — new route to capture PayPal payments server-side after approval
- Rewrote src/app/api/subscription/webhook/route.ts — full PayPal webhook handler:
  - Verifies webhook signatures
  - Handles PAYMENT.CAPTURE.COMPLETED to auto-activate subscriptions
  - Fallback lookup by PayPal order ID
- Created src/components/coursia/PayPalProvider.tsx — React PayPalScriptProvider wrapper
- Rewrote src/components/coursia/OffersPage.tsx — replaced Chariow redirect flow with PayPal Checkout buttons:
  - PayPalButtons component from @paypal/react-paypal-js
  - createOrder calls backend API
  - onApprove calls capture endpoint
  - Error/cancel handling
  - Processing/success states
  - Graceful fallback when PayPal not configured
- Updated src/components/coursia/AppShell.tsx — wrapped OffersPage with PayPalProviderWrapper

Stage Summary:
- PayPal integration is complete in sandbox mode
- User needs to: get sandbox credentials from PayPal Developer Dashboard and fill .env
- Files changed: .env, src/lib/paypal.ts, checkout/route.ts, capture/route.ts, webhook/route.ts, PayPalProvider.tsx, OffersPage.tsx, AppShell.tsx
- Lint passes for all src/ files (0 errors)
- Chariow/Fondeka references still exist in confirm/approve/reject admin routes (to be cleaned later)
