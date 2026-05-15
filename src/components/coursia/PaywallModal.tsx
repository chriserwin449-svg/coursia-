"use client";

import { Lock, Crown, Sparkles, X, BookOpen, Brain, BarChart3, FileText } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

interface PaywallModalProps {
  onClose: () => void;
  onUpgrade: () => void;
  lang: Lang;
}

const benefitIcons = [BookOpen, Brain, BarChart3, FileText];

export default function PaywallModal({ onClose, onUpgrade, lang }: PaywallModalProps) {
  const tx = t(lang);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg glass rounded-3xl p-8 md:p-10 shadow-2xl shadow-mauve/20 animate-fade-in-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 transition-colors duration-200 cursor-pointer"
          aria-label={lang === "fr" ? "Fermer" : "Close"}
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-mauve to-gold flex items-center justify-center shadow-lg shadow-mauve/30">
              <Lock className="w-9 h-9 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gold flex items-center justify-center shadow-lg shadow-gold/30">
              <Crown className="w-4 h-4 text-black" />
            </div>
          </div>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-2">
          <span className="gradient-text">{tx.paywall.title}</span>
        </h2>
        <p className="text-muted-foreground text-center text-base md:text-lg mb-2">{tx.paywall.subtitle}</p>
        <p className="text-muted-foreground/70 text-center text-sm mb-8">{tx.paywall.description}</p>
        <div className="space-y-3 mb-10">
          {tx.paywall.benefits.map((benefit, i) => {
            const Icon = benefitIcons[i];
            return (
              <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-night/60 border border-border/50 hover:border-mauve/20 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-mauve/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-mauve-light" />
                </div>
                <span className="text-sm font-semibold text-foreground">{benefit}</span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={onUpgrade}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-mauve to-gold text-white font-bold text-base hover:from-mauve-light hover:to-gold-light transition-all duration-300 cursor-pointer shadow-lg shadow-mauve/25 hover:shadow-mauve/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-5 h-5" />
            {tx.paywall.upgrade}
          </button>
          <button
            onClick={onClose}
            className="w-full px-6 py-3 rounded-2xl glass text-muted-foreground font-semibold text-sm hover:text-foreground hover:bg-white/5 transition-all duration-200 cursor-pointer"
          >
            {tx.paywall.later}
          </button>
        </div>
      </div>
    </div>
  );
}
