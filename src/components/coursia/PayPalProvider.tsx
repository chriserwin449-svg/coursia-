"use client";

import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

interface PayPalConfig {
  configured: boolean;
  clientId: string;
  mode: "sandbox" | "live";
}

export function PayPalProviderWrapper({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const lang = useAppStore((s) => s.lang);

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

  // Determine locale based on user language
  const locale = lang === "fr" ? "fr_FR" : "en_US";

  console.log("[paypal-sdk] Loading PayPal JS SDK:", {
    mode: config.mode,
    currency: "USD",
    intent: "capture",
    locale,
    clientId: config.clientId.substring(0, 8) + "...",
  });

  return (
    <PayPalScriptProvider
      options={{
        clientId: config.clientId,
        currency: "USD",
        intent: "capture",
        // Components: buttons renders the PayPal payment buttons
        // card-fields is needed for advanced card fields (optional, buttons include card option)
        components: "buttons",
        // Locale: match the user's language for PayPal UI
        locale,
        // DO NOT disable card funding — this is critical for allowing card payments
        // enable-funding explicitly ensures card is available even if PayPal would otherwise hide it
        "enable-funding": "card",
      }}
      deferLoading={false}
    >
      {children}
    </PayPalScriptProvider>
  );
}