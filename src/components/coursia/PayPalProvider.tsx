"use client";

import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useEffect, useState } from "react";

interface PayPalConfig {
  configured: boolean;
  clientId: string;
  mode: "sandbox" | "live";
}

export function PayPalProviderWrapper({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/paypal/config")
      .then((res) => res.json())
      .then((data: PayPalConfig) => setConfig(data))
      .catch(() => setConfig({ configured: false, clientId: "", mode: "sandbox" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !config || !config.configured) {
    // PayPal not configured or still loading — render children without PayPal
    return <>{children}</>;
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId: config.clientId,
        currency: "USD",
        intent: "capture",
      }}
    >
      {children}
    </PayPalScriptProvider>
  );
}
