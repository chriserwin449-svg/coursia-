"use client";

import { Crown } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function ProOnlyBadge() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/15 text-gold text-xs font-bold">
      <Crown className="w-3 h-3" />
      {tx.common.pro}
    </span>
  );
}
