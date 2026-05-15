"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function SettingsPage() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);

  return (
    <div className="max-w-2xl mx-auto px-6 pt-20 pb-8">
      <h1 className="text-3xl font-extrabold gradient-text mb-8">{tx.settings.title}</h1>
      <div className="glass rounded-3xl p-6">
        <p className="text-muted-foreground">{tx.settings.subtitle || "Paramètres du compte"}</p>
      </div>
    </div>
  );
}
