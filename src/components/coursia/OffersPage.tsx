"use client";

import { Check, Crown, Zap, HelpCircle, ChevronDown, Star, AlertTriangle, Loader2, Clock, ShieldAlert, Gift } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useState, useMemo, useEffect, useCallback } from "react";

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass rounded-2xl overflow-hidden transition-all duration-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-white/5 transition-colors duration-200"
      >
        <div className="flex items-center gap-3 min-w-0">
          <HelpCircle className="w-4 h-4 text-mauve-light flex-shrink-0" />
          <span className={`font-semibold text-sm text-foreground transition-all duration-200 ${open ? 'text-mauve-light' : ''}`}>
            {question}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ml-2 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-4 pl-12">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OffersPage() {
  const lang = useAppStore((s) => s.lang);
  const userId = useAppStore((s) => s.userId);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setView = useAppStore((s) => s.setView);
  const tx = t(lang);

  const [trialExpired, setTrialExpired] = useState(false);
  const [inTrial, setInTrial] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [trialCoursesGenerated, setTrialCoursesGenerated] = useState(0);
  const [trialCoursesMax] = useState(3);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [graceDaysRemaining, setGraceDaysRemaining] = useState(0);
  const [graceExpired, setGraceExpired] = useState(false);
  const [showRenewalReminder, setShowRenewalReminder] = useState(false);
  const [renewalDaysRemaining, setRenewalDaysRemaining] = useState(0);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Check paywall & subscription status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const headers: Record<string, string> = {};
        if (userId) headers["Authorization"] = `Bearer ${userId}`;

        const res = await fetch("/api/courses/paywall-status", { headers });
        const data = await res.json();

        // Trial
        if (data.inTrial) {
          setInTrial(true);
          setTrialDaysRemaining(data.trialDaysRemaining || 0);
          setTrialCoursesGenerated(data.trialCoursesGenerated || 0);
        } else if (data.showPaywall && data.paywallReason === "trial_expired") {
          setTrialExpired(true);
        }

        // Subscription
        if (data.hasSubscription && data.subscriptionStatus === "active") {
          setIsSubscribed(true);
          setTrialExpired(false);
          if (data.showRenewalReminder) {
            setShowRenewalReminder(true);
            setRenewalDaysRemaining(data.renewalDaysRemaining || 0);
          }
        }

        // Grace period
        if (data.inGracePeriod) {
          setInGracePeriod(true);
          setGraceDaysRemaining(data.graceDaysRemaining || 0);
        } else if (data.showPaywall && data.paywallReason === "grace_expired") {
          setGraceExpired(true);
        }
      } catch {
        // silently fail
      }
    };
    checkStatus();
  }, [userId]);

  // Handle checkout
  const handleCheckout = useCallback(
    async (plan: "monthly" | "annual") => {
      if (!isAuthenticated || !userId) {
        setView("auth");
        return;
      }

      setLoadingPlan(plan);
      setCheckoutError(null);

      try {
        const res = await fetch("/api/subscription/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, userId }),
        });

        const data = await res.json();

        if (!res.ok || !data.checkoutUrl) {
          setCheckoutError(
            data.error || (lang === "fr" ? "Erreur lors de la création du paiement" : "Payment creation failed")
          );
          return;
        }

        // Redirect to Creem checkout
        window.location.href = data.checkoutUrl;
      } catch {
        setCheckoutError(
          lang === "fr" ? "Erreur de connexion. Réessaie." : "Connection error. Please try again."
        );
      } finally {
        setLoadingPlan(null);
      }
    },
    [isAuthenticated, userId, lang, setView]
  );

  // Check URL params for checkout result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      const checkAfterCheckout = async () => {
        try {
          const headers: Record<string, string> = {};
          if (userId) headers["Authorization"] = `Bearer ${userId}`;

          const res = await fetch("/api/courses/paywall-status", { headers });
          const data = await res.json();
          if (data.hasSubscription && data.subscriptionStatus === "active") {
            setIsSubscribed(true);
            setTrialExpired(false);
            setInGracePeriod(false);
            setGraceExpired(false);
          }
        } catch {
          // silently fail
        }
      };
      setTimeout(checkAfterCheckout, 2000);
    }
  }, [userId]);

  const suffix = (n: number) => (n > 1 ? (lang === "fr" ? "s" : "s") : "");

  const faqs = useMemo(() => {
    if (lang === "fr") {
      return [
        {
          q: "Comment fonctionne le paiement sur Coursia ?",
          a: "Le paiement est géré par Creem, une plateforme sécurisée. Tu seras redirigé vers la page de paiement de Creem où tu pourras payer par carte bancaire. Après le paiement, ton accès Pro est activé immédiatement.",
        },
        {
          q: "Puis-je annuler mon abonnement à tout moment ?",
          a: "Oui, tu peux annuler ton abonnement à tout moment. Ton accès reste actif jusqu'à la fin de la période payée. Après la fin, tu as 3 jours de grâce pour relire tes cours.",
        },
        {
          q: "Quelle différence entre le plan Mensuel et Annuel ?",
          a: "Les deux plans offrent les mêmes fonctionnalités. Le plan Annuel te fait économiser 64 % par rapport au paiement mensuel, soit l'équivalent de 4 mois gratuits.",
        },
        {
          q: "Comment fonctionne l'essai gratuit de 7 jours ?",
          a: "Tu peux créer jusqu'à 3 cours pendant tes 7 jours d'essai. Après l'essai, tu dois souscrire un abonnement pour continuer à créer des cours. Si tu paies pendant l'essai, celui-ci s'arrête immédiatement.",
        },
        {
          q: "Que se passe-t-il quand mon abonnement se termine ?",
          a: "Tu disposes de 3 jours pour relire tes cours déjà créés (lecture seule). Après ces 3 jours, tu devras renouveler ton abonnement pour retrouver l'accès complet.",
        },
      ];
    }
    return [
      {
        q: "How does payment work on Coursia?",
        a: "Payment is handled by Creem, a secure platform. You'll be redirected to Creem's payment page where you can pay by card. After payment, your Pro access is activated immediately.",
      },
      {
        q: "Can I cancel my subscription at any time?",
        a: "Yes, you can cancel your subscription at any time. Your access remains active until the end of the paid period. After that, you have a 3-day grace period to review your courses.",
      },
      {
        q: "What's the difference between Monthly and Annual?",
        a: "Both plans offer the same features. The Annual plan saves you 64% compared to monthly billing — that's 4 months free.",
      },
      {
        q: "How does the 7-day free trial work?",
        a: "You can create up to 3 courses during your 7-day trial. After the trial, you need to subscribe to keep creating courses. If you pay during the trial, it ends immediately.",
      },
      {
        q: "What happens when my subscription ends?",
        a: "You get 3 days to review your existing courses (read-only). After those 3 days, you'll need to renew your subscription to restore full access.",
      },
    ];
  }, [lang]);

  return (
    <>
    <div className="min-h-screen bg-night px-4 sm:px-6 md:px-10 pt-14 sm:pt-20 pb-4 sm:pb-6 md:pb-10 lg:pb-14 md:pt-24">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-mauve/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* ===== HEADER ===== */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4">
            <span className="gradient-text">{tx.offers.title}</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {tx.offers.subtitle}
          </p>
        </div>

        {/* ===== STATUS BANNERS ===== */}
        <div className="max-w-2xl mx-auto mb-8 space-y-3">
          {/* Renewal reminder (subscribed, ending soon) */}
          {showRenewalReminder && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
              <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm sm:text-base text-amber-200 font-medium">
                  {tx.offers.renewalReminder.replace("{days}", String(renewalDaysRemaining)).replace("{suffix}", suffix(renewalDaysRemaining))}
                </p>
              </div>
            </div>
          )}

          {/* Subscription ended, in grace period */}
          {inGracePeriod && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
              <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm sm:text-base text-amber-200 font-medium">
                  {tx.offers.gracePeriod.replace("{days}", String(graceDaysRemaining)).replace("{suffix}", suffix(graceDaysRemaining))}
                </p>
                <p className="text-xs text-amber-300/70 mt-1">{tx.offers.graceReadonly}</p>
              </div>
            </div>
          )}

          {/* Grace period expired */}
          {graceExpired && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-red-500/10 border border-red-500/30 animate-fade-in">
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm sm:text-base text-red-200 font-medium">
                {tx.offers.gracePeriodExpired}
              </p>
            </div>
          )}

          {/* Trial active banner */}
          {inTrial && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-mauve/10 border border-mauve/30 animate-fade-in">
              <Gift className="w-5 h-5 text-mauve-light flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm sm:text-base text-mauve-light font-medium">
                  {tx.offers.daysRemaining.replace("{days}", String(trialDaysRemaining)).replace("{suffix}", suffix(trialDaysRemaining))}
                </p>
                <p className="text-xs text-mauve-light/70 mt-1">
                  {tx.offers.coursesRemaining.replace("{count}", String(trialCoursesMax - trialCoursesGenerated)).replace("{suffix}", suffix(trialCoursesMax - trialCoursesGenerated))}
                </p>
              </div>
            </div>
          )}

          {/* Trial expired banner */}
          {trialExpired && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm sm:text-base text-amber-200 font-medium">
                {tx.offers.trialExpired}
              </p>
            </div>
          )}

          {/* Already subscribed banner */}
          {isSubscribed && !showRenewalReminder && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 animate-fade-in">
              <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm sm:text-base text-emerald-200 font-medium">
                {tx.offers.subscribed}
              </p>
            </div>
          )}

          {/* Checkout error */}
          {checkoutError && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-red-500/10 border border-red-500/30 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm sm:text-base text-red-200 font-medium">{checkoutError}</p>
            </div>
          )}
        </div>

        {/* ===== PRICING CARDS ===== */}
        <div className={`grid gap-6 lg:gap-8 items-start mb-20 ${
          (trialExpired || graceExpired)
            ? "grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto"
            : "grid-cols-1 md:grid-cols-3"
        }`}>
          {/* FREE PLAN — hidden when trial expired or grace expired */}
          {!trialExpired && !graceExpired && (
          <div className="pricing-card-float glass rounded-3xl p-5 sm:p-8 flex flex-col hover:border-mauve/30 transition-all duration-300">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-mauve/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-mauve-light" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">{tx.landing.pricing.free.name}</h3>
              </div>
              <p className="text-muted-foreground text-sm">{tx.landing.pricing.free.desc}</p>
            </div>
            <div className="mb-6">
              <span className="text-3xl sm:text-4xl font-extrabold">{tx.landing.pricing.free.price}</span>
              {lang === "fr" && (
                <p className="text-sm text-gold font-semibold mt-1">{tx.landing.pricing.free.note}</p>
              )}
            </div>
            <ul className="flex-1 space-y-2 sm:space-y-3 mb-8">
              {tx.landing.pricing.free.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <button className="w-full py-3.5 sm:py-4 rounded-full border border-muted-foreground/20 text-foreground font-bold hover:bg-muted-foreground/10 transition-all duration-300 cursor-pointer">
              {tx.landing.pricing.free.cta}
            </button>
          </div>
          )}

          {/* MONTHLY PLAN */}
          <div className="pricing-card-float monthly-card-glow glass rounded-3xl p-5 sm:p-8 flex flex-col hover:border-mauve/30 transition-all duration-300">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-mauve/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-mauve-light" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">{tx.landing.pricing.monthly.name}</h3>
              </div>
              <p className="text-muted-foreground text-sm">{tx.landing.pricing.monthly.desc}</p>
            </div>
            <div className="mb-6">
              <span className="text-3xl sm:text-4xl font-extrabold">{tx.landing.pricing.monthly.price}</span>
              <span className="text-lg text-muted-foreground">{tx.landing.pricing.monthly.period}</span>
            </div>
            <ul className="flex-1 space-y-2 sm:space-y-3 mb-8">
              {tx.landing.pricing.monthly.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout("monthly")}
              disabled={loadingPlan === "monthly" || (isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired)}
              className="w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 glow-mauve cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingPlan === "monthly" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {lang === "fr" ? "Redirection..." : "Redirecting..."}
                </>
              ) : isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired ? (
                <>{lang === "fr" ? "Plan Actuel" : "Current Plan"}</>
              ) : (
                tx.landing.pricing.monthly.cta
              )}
            </button>
          </div>

          {/* ANNUAL PLAN — highlighted */}
          <div className="pricing-card-float annual-card-shimmer relative glass rounded-3xl p-5 sm:p-8 flex flex-col border-2 border-gold/50 hover:border-gold/70 transition-all duration-300 shadow-[0_0_40px_rgba(234,179,8,0.1)]">
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
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gold/10 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-gold" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">{tx.landing.pricing.annual.name}</h3>
              </div>
              <p className="text-muted-foreground text-sm">{tx.landing.pricing.annual.desc}</p>
            </div>
            <div className="mb-6">
              <span className="text-3xl sm:text-4xl font-extrabold">{tx.landing.pricing.annual.price}</span>
              <span className="text-lg text-muted-foreground">{tx.landing.pricing.annual.period}</span>
            </div>
            <ul className="flex-1 space-y-2 sm:space-y-3 mb-8">
              {tx.landing.pricing.annual.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout("annual")}
              disabled={loadingPlan === "annual" || (isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired)}
              className="annual-btn-shimmer w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night font-bold hover:from-amber-400 hover:to-gold transition-all duration-300 shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden flex items-center justify-center gap-2"
            >
              {loadingPlan === "annual" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {lang === "fr" ? "Redirection..." : "Redirecting..."}
                </>
              ) : isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired ? (
                <>{lang === "fr" ? "Plan Actuel" : "Current Plan"}</>
              ) : (
                tx.landing.pricing.annual.cta
              )}
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

          <div className="space-y-2">
            {faqs.map((faq, idx) => (
              <FAQItem key={idx} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>

        {/* ===== BOTTOM NOTE ===== */}
        <div className="text-center pb-10">
          <p className="text-xs text-muted-foreground/50">
            {lang === "fr"
              ? "Paiement sécurisé via Creem"
              : "Secure payment via Creem"}
          </p>
        </div>
      </div>
    </div>

    {/* ===== ANIMATIONS ===== */}
    <style jsx global>{`
      @keyframes shimmer-sweep {
        0% { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { transform: translateX(200%) skewX(-15deg); opacity: 0; }
      }
      .annual-card-shimmer { position: relative; overflow: hidden; }
      .annual-card-shimmer::before {
        content: '';
        position: absolute; top: 0; left: 0;
        width: 60%; height: 100%;
        background: linear-gradient(90deg, transparent 0%, rgba(234,179,8,0.06) 20%, rgba(255,255,255,0.12) 40%, rgba(234,179,8,0.06) 60%, transparent 100%);
        z-index: 1; pointer-events: none; border-radius: inherit;
        animation: shimmer-sweep 3s ease-in-out infinite;
      }
      .annual-card-shimmer > * { position: relative; z-index: 2; }

      @keyframes float-card {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }
      .pricing-card-float {
        transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .pricing-card-float:hover {
        animation: float-card 1.8s ease-in-out infinite;
        box-shadow: 0 25px 60px -12px rgba(0,0,0,0.4), 0 0 30px rgba(168,85,247,0.08);
      }

      @keyframes pulse-glow-gold {
        0%, 100% { box-shadow: 0 0 8px rgba(234,179,8,0.3), 0 0 16px rgba(234,179,8,0.15); }
        50% { box-shadow: 0 0 16px rgba(234,179,8,0.5), 0 0 32px rgba(234,179,8,0.25), 0 0 48px rgba(234,179,8,0.1); }
      }
      .annual-badge-pulse { animation: pulse-glow-gold 2.5s ease-in-out infinite; }

      @keyframes btn-shimmer {
        0% { background-position: -200% center; }
        100% { background-position: 200% center; }
      }
      .annual-btn-shimmer {
        background-size: 200% auto;
        background-image: linear-gradient(90deg, #eab308 0%, #f59e0b 25%, #fde68a 40%, #f59e0b 55%, #eab308 75%, #f59e0b 100%);
        animation: btn-shimmer 2.5s linear infinite;
      }

      @keyframes monthly-glow {
        0%, 100% { box-shadow: 0 0 10px rgba(168,85,247,0.1), 0 0 20px rgba(168,85,247,0.05); }
        50% { box-shadow: 0 0 20px rgba(168,85,247,0.25), 0 0 40px rgba(168,85,247,0.12), 0 0 60px rgba(168,85,247,0.06); }
      }
      .monthly-card-glow:hover {
        border-color: rgba(168,85,247,0.45) !important;
        animation: monthly-glow 2s ease-in-out infinite;
      }

      @keyframes fade-in {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in { animation: fade-in 0.4s ease-out; }
    `}</style>
    </>
  );
}
