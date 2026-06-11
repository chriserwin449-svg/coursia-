"use client";

import { PayPalScriptProvider } from "@paypal/react-paypal-js";

export function PayPalProviderWrapper({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

  if (!clientId || clientId === "YOUR_PAYPAL_SANDBOX_CLIENT_ID") {
    // PayPal not configured — render children without PayPal (buttons won't work)
    return <>{children}</>;
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: "USD",
        intent: "capture",
        "data-client-token": "", // optional
      }}
    >
      {children}
    </PayPalScriptProvider>
  );
}
