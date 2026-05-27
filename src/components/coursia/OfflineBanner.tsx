"use client";

import { useState } from "react";
import { WifiOff, X, CreditCard } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function OfflineBanner() {
  const lang = useAppStore((s) => s.lang);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-blue-600/95 backdrop-blur-md text-white animate-slide-down">
      <div className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span className="hidden sm:inline">
          {lang === "fr"
            ? "Vous étudiez en mode hors-ligne. Veuillez vous réabonner pour continuer à progresser."
            : "You're studying in offline mode. Please resubscribe to continue progressing."}
        </span>
        <span className="sm:hidden">
          {lang === "fr"
            ? "Mode hors-ligne. Réabonnez-vous pour progresser."
            : "Offline mode. Resubscribe to progress."}
        </span>
        <button
          onClick={() => useAppStore.getState().setView("offers")}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-xs font-bold cursor-pointer flex-shrink-0"
        >
          <CreditCard className="w-3.5 h-3.5" />
          {lang === "fr" ? "S'abonner" : "Subscribe"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer flex-shrink-0"
          aria-label={lang === "fr" ? "Fermer" : "Close"}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
