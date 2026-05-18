"use client";

import { Check, Crown, Zap, HelpCircle, ChevronDown, Star } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useState, useMemo } from "react";

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer hover:bg-white/5 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-mauve-light flex-shrink-0" />
          <span className="font-bold text-sm sm:text-base text-foreground">
            {question}
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-6 pb-5 pl-14">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function OffersPage() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);

  const faqs = useMemo(() => {
    if (lang === "fr") {
      return [
          {
            q: "Puis-je annuler mon abonnement à tout moment ?",
            a: "Oui, tu peux annuler ton abonnement à tout moment depuis tes paramètres. Ton accès reste actif jusqu'à la fin de la période payée.",
          },
          {
            q: "Comment fonctionne la période d'essai gratuite ?",
            a: "Avec le plan Découverte, tu peux créer 3 cours gratuitement pendant 7 jours. Tu peux lire et étudier tes cours pendant toute la période d'essai. Aucune carte bancaire n'est requise pour commencer.",
          },
          {
            q: "Quelle différence entre le plan Mensuel et Annuel ?",
            a: "Les deux plans offrent les mêmes fonctionnalités. Le plan Annuel te fait économiser 67 % par rapport au paiement mensuel, soit l'équivalent de 4 mois gratuits.",
          },
          {
            q: "Les cours sont-ils disponibles hors ligne ?",
            a: "Actuellement, les cours sont accessibles uniquement en ligne. Nous travaillons sur une fonctionnalité de téléchargement hors ligne pour bientôt.",
          },
          {
            q: "Puis-je partager mon compte avec quelqu'un d'autre ?",
            a: "Chaque compte est strictement personnel. Partager ton compte est contraire à nos conditions d'utilisation. Chaque utilisateur doit avoir son propre abonnement.",
          },
        ];
    }
    return [
          {
            q: "Can I cancel my subscription at any time?",
            a: "Yes, you can cancel your subscription at any time from your settings. Your access remains active until the end of the paid period.",
          },
          {
            q: "How does the free trial work?",
            a: "With the Discovery plan, you can create 3 free courses for 7 days. You can read and study your courses during the entire trial period. No credit card is required to get started.",
          },
          {
            q: "What's the difference between Monthly and Annual?",
            a: "Both plans offer the same features. The Annual plan saves you 67% compared to monthly billing — that's 4 months free.",
          },
          {
            q: "Are courses available offline?",
            a: "Currently, courses are only accessible online. We're working on an offline download feature coming soon.",
          },
          {
            q: "Can I share my account with someone else?",
            a: "Each account is strictly personal. Sharing your account violates our terms of service. Each user must have their own subscription.",
          },
        ];
  }, [lang]);

  return (
    <>
    <div className="min-h-screen bg-night px-6 md:px-10 pt-20 pb-4 sm:pb-6 md:pb-10 lg:pb-14 md:pt-24">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-mauve/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* ===== HEADER ===== */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4">
            <span className="gradient-text">{tx.offers.title}</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {tx.offers.subtitle}
          </p>
        </div>

        {/* ===== PRICING CARDS ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start mb-20">
          {/* FREE PLAN */}
          <div className="pricing-card-float glass rounded-3xl p-8 flex flex-col hover:border-mauve/30 transition-all duration-300">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-mauve/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-mauve-light" />
                </div>
                <h3 className="text-xl font-bold">{tx.landing.pricing.free.name}</h3>
              </div>
              <p className="text-muted-foreground text-sm">{tx.landing.pricing.free.desc}</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-extrabold">{tx.landing.pricing.free.price}</span>
              {lang === "fr" && (
                <p className="text-sm text-gold font-semibold mt-1">{tx.landing.pricing.free.note}</p>
              )}
            </div>
            <ul className="flex-1 space-y-3 mb-8">
              {tx.landing.pricing.free.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <button className="w-full py-4 rounded-full border border-muted-foreground/20 text-foreground font-bold hover:bg-muted-foreground/10 transition-all duration-300 cursor-pointer">
              {tx.landing.pricing.free.cta}
            </button>
          </div>

          {/* MONTHLY PLAN */}
          <div className="pricing-card-float monthly-card-glow glass rounded-3xl p-8 flex flex-col hover:border-mauve/30 transition-all duration-300">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-mauve/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-mauve-light" />
                </div>
                <h3 className="text-xl font-bold">{tx.landing.pricing.monthly.name}</h3>
              </div>
              <p className="text-muted-foreground text-sm">{tx.landing.pricing.monthly.desc}</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-extrabold">{tx.landing.pricing.monthly.price}</span>
              <span className="text-lg text-muted-foreground">{tx.landing.pricing.monthly.period}</span>
            </div>
            <ul className="flex-1 space-y-3 mb-8">
              {tx.landing.pricing.monthly.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <button className="w-full py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 glow-mauve cursor-pointer">
              {tx.landing.pricing.monthly.cta}
            </button>
          </div>

          {/* ANNUAL PLAN — highlighted */}
          <div className="pricing-card-float annual-card-shimmer relative glass rounded-3xl p-8 flex flex-col border-2 border-gold/50 hover:border-gold/70 transition-all duration-300 shadow-[0_0_40px_rgba(234,179,8,0.1)]">
            {/* Popular badge */}
            <span className="annual-badge-pulse absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night text-xs font-extrabold uppercase tracking-wider z-10">
              <span className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" />
                {tx.landing.pricing.annual.badge}
              </span>
            </span>

            {/* Save badge */}
            <div className="flex justify-end mb-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                {tx.landing.pricing.annual.save}
              </span>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-gold" />
                </div>
                <h3 className="text-xl font-bold">{tx.landing.pricing.annual.name}</h3>
              </div>
              <p className="text-muted-foreground text-sm">{tx.landing.pricing.annual.desc}</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-extrabold">{tx.landing.pricing.annual.price}</span>
              <span className="text-lg text-muted-foreground">{tx.landing.pricing.annual.period}</span>
            </div>
            <ul className="flex-1 space-y-3 mb-8">
              {tx.landing.pricing.annual.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <button className="annual-btn-shimmer w-full py-4 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night font-bold hover:from-amber-400 hover:to-gold transition-all duration-300 shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] cursor-pointer relative overflow-hidden">
              {tx.landing.pricing.annual.cta}
            </button>
          </div>
        </div>

        {/* ===== FAQ SECTION ===== */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
              <span className="gradient-text">{tx.offers.faq}</span>
            </h2>
            <div className="flex items-center justify-center gap-1.5 text-gold">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-gold text-gold" />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <FAQItem key={idx} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>

        {/* ===== BOTTOM NOTE ===== */}
        <div className="text-center pb-10">
          <p className="text-xs text-muted-foreground/50">
            {lang === "fr"
              ? "Paiement sécurisé via LemonSqueezy"
              : "Secure payment via LemonSqueezy"}
          </p>
        </div>
      </div>
    </div>

    {/* ===== ANIMATIONS ===== */}
    <style jsx global>{`
      /* ── Shimmer sweep across the annual card (holographic shine) ── */
      @keyframes shimmer-sweep {
        0% {
          transform: translateX(-100%) skewX(-15deg);
          opacity: 0;
        }
        20% {
          opacity: 1;
        }
        80% {
          opacity: 1;
        }
        100% {
          transform: translateX(200%) skewX(-15deg);
          opacity: 0;
        }
      }

      .annual-card-shimmer {
        position: relative;
        overflow: hidden;
      }

      .annual-card-shimmer::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 60%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(234, 179, 8, 0.06) 20%,
          rgba(255, 255, 255, 0.12) 40%,
          rgba(234, 179, 8, 0.06) 60%,
          transparent 100%
        );
        z-index: 1;
        pointer-events: none;
        border-radius: inherit;
        animation: shimmer-sweep 3s ease-in-out infinite;
      }

      /* Ensure card content stays above the shimmer overlay */
      .annual-card-shimmer > * {
        position: relative;
        z-index: 2;
      }

      /* ── Subtle float animation on hover for all pricing cards ── */
      @keyframes float-card {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-8px);
        }
      }

      .pricing-card-float {
        transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .pricing-card-float:hover {
        animation: float-card 1.8s ease-in-out infinite;
        box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.4),
                    0 0 30px rgba(168, 85, 247, 0.08);
      }

      /* ── Gold glow pulse on the annual badge ── */
      @keyframes pulse-glow-gold {
        0%, 100% {
          box-shadow: 0 0 8px rgba(234, 179, 8, 0.3),
                      0 0 16px rgba(234, 179, 8, 0.15);
        }
        50% {
          box-shadow: 0 0 16px rgba(234, 179, 8, 0.5),
                      0 0 32px rgba(234, 179, 8, 0.25),
                      0 0 48px rgba(234, 179, 8, 0.1);
        }
      }

      .annual-badge-pulse {
        animation: pulse-glow-gold 2.5s ease-in-out infinite;
      }

      /* ── Shimmer gradient animation on the annual CTA button ── */
      @keyframes btn-shimmer {
        0% {
          background-position: -200% center;
        }
        100% {
          background-position: 200% center;
        }
      }

      .annual-btn-shimmer {
        background-size: 200% auto;
        background-image: linear-gradient(
          90deg,
          #eab308 0%,
          #f59e0b 25%,
          #fde68a 40%,
          #f59e0b 55%,
          #eab308 75%,
          #f59e0b 100%
        );
        animation: btn-shimmer 2.5s linear infinite;
      }

      /* ── Mauve border glow animation on monthly card hover ── */
      @keyframes monthly-glow {
        0%, 100% {
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.1),
                      0 0 20px rgba(168, 85, 247, 0.05);
        }
        50% {
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.25),
                      0 0 40px rgba(168, 85, 247, 0.12),
                      0 0 60px rgba(168, 85, 247, 0.06);
        }
      }

      .monthly-card-glow:hover {
        border-color: rgba(168, 85, 247, 0.45) !important;
        animation: monthly-glow 2s ease-in-out infinite;
      }
    `}</style>
    </>
  );
}
