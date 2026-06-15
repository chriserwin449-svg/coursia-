"use client";

import {
  Check,
  Crown,
  Zap,
  AlertTriangle,
  Loader2,
  Clock,
  ShieldAlert,
  Gift,
  Lock,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
// PayPal buttons removed — using custom CTA buttons with redirect flow

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
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>("");
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [graceDaysRemaining, setGraceDaysRemaining] = useState(0);
  const [graceExpired, setGraceExpired] = useState(false);
  const [showRenewalReminder, setShowRenewalReminder] = useState(false);
  const [renewalDaysRemaining, setRenewalDaysRemaining] = useState(0);
  const [renewalUrgency, setRenewalUrgency] = useState<string>("none");
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | undefined>();
  const [firstName, setFirstName] = useState<string>("");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // PayPal payment flow states
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Countdown timer for last 24 hours
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // PayPal is always assumed configured — the checkout API will handle errors if not
  const isPaypalConfigured = true;

  // Handle checkout — create order and redirect to PayPal
  const handleCheckout = useCallback(async (plan: string) => {
    if (!isAuthenticated || !userId) {
      setView("auth");
      return;
    }
    if (loadingPlan) return;

    setLoadingPlan(plan);
    setCheckoutError(null);

    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCheckoutError(data.error || (lang === "fr" ? "Erreur lors du paiement" : "Payment failed"));
        setLoadingPlan(null);
        return;
      }

      if (data.requestId) setPaymentRequestId(data.requestId);
      setPaypalOrderId(data.orderId);

      // Redirect to PayPal for approval
      if (data.approveUrl) {
        trackEvent({ name: "payment_init", properties: { plan } });
        window.location.href = data.approveUrl;
      } else {
        setCheckoutError(lang === "fr" ? "Lien PayPal indisponible." : "PayPal link unavailable.");
        setLoadingPlan(null);
      }
    } catch {
      setCheckoutError(lang === "fr" ? "Erreur de connexion. Réessaie." : "Connection error. Please try again.");
      setLoadingPlan(null);
    }
  }, [isAuthenticated, userId, lang, setView, loadingPlan]);

  // Check paywall & subscription status
  useEffect(() => {
    // Track when user views the pricing page
    trackEvent({ name: "pricing_viewed" });

    const checkStatus = async () => {
      try {
        const headers: Record<string, string> = {};
        if (userId) headers["Authorization"] = `Bearer ${userId}`;

        const res = await fetch("/api/courses/paywall-status", { headers });
        const data = await res.json();

        if (data.firstName) setFirstName(data.firstName);

        if (data.inTrial) {
          setInTrial(true);
          setTrialDaysRemaining(data.trialDaysRemaining || 0);
          setTrialCoursesGenerated(data.trialCoursesGenerated || 0);
        } else if (data.showPaywall && data.paywallReason === "trial_expired") {
          setTrialExpired(true);
        }

        if (data.hasSubscription && data.subscriptionStatus === "active") {
          setIsSubscribed(true);
          setSubscriptionPlan(data.subscriptionPlan || "monthly");
          setTrialExpired(false);

          if (data.showRenewalReminder) {
            setShowRenewalReminder(true);
            setRenewalDaysRemaining(data.renewalDaysRemaining || 0);
            setRenewalUrgency(data.renewalUrgency || "none");
            setTimeRemainingMs(data.timeRemainingMs);
          }
        }

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

  // Countdown timer for last 24 hours
  useEffect(() => {
    if (renewalUrgency !== "last24hours" || !timeRemainingMs) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, timeRemainingMs - (now - ((window as unknown as Record<string, number>).__countdownStart || now)));

      if (remaining <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setCountdown({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const totalSeconds = Math.floor(remaining / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setCountdown({ hours, minutes, seconds });
    };

    (window as unknown as Record<string, number>).__countdownStart = Date.now();

    const fetchFreshTime = async () => {
      try {
        const headers: Record<string, string> = {};
        if (userId) headers["Authorization"] = `Bearer ${userId}`;
        const res = await fetch("/api/courses/paywall-status", { headers });
        const data = await res.json();
        if (data.timeRemainingMs) {
          setTimeRemainingMs(data.timeRemainingMs);
          (window as unknown as Record<string, number>).__countdownStart = Date.now();
        }
      } catch { /* ignore */ }
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    const refreshInterval = setInterval(fetchFreshTime, 30_000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      clearInterval(refreshInterval);
    };
  }, [renewalUrgency, timeRemainingMs, userId]);

  // Get renewal reminder message
  const getRenewalMessage = useMemo(() => {
    const name = firstName || (lang === "fr" ? "Bonjour" : "Hey");
    const isAnnual = subscriptionPlan === "annual";

    if (renewalUrgency === "last24hours") {
      const key = isAnnual ? "renewalAnnual24hCountdown" : "renewalMonthly24hCountdown";
      return tx.offers[key]
        .replace("{name}", name)
        .replace("{hours}", String(countdown.hours))
        .replace("{minutes}", String(countdown.minutes).padStart(2, "0"))
        .replace("{seconds}", String(countdown.seconds).padStart(2, "0"));
    }

    const keyMap: Record<string, string> = isAnnual
      ? {
          "1month": "renewalAnnual1Month",
          "2weeks": "renewalAnnual2Weeks",
          "1week": "renewalAnnual1Week",
          "3days": "renewalAnnual3Days",
          "24hours": "renewalAnnual24Hours",
        }
      : {
          "1week": "renewalMonthly1Week",
          "3days": "renewalMonthly3Days",
          "24hours": "renewalMonthly24Hours",
        };

    const key = keyMap[renewalUrgency];
    if (key && (tx.offers as Record<string, string>)[key]) {
      return (tx.offers as Record<string, string>)[key].replace("{name}", name);
    }

    return null;
  }, [renewalUrgency, firstName, subscriptionPlan, lang, countdown, tx.offers]);

  const getUrgencyColor = () => {
    if (renewalUrgency === "last24hours" || renewalUrgency === "24hours" || renewalUrgency === "3days") {
      return "bg-red-500/10 border-red-500/30 text-red-200";
    }
    return "bg-amber-500/10 border-amber-500/30 text-amber-200";
  };

  // Check URL params for payment success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const planParam = params.get("plan");

    if (paymentStatus === "success" && planParam) {
      window.history.replaceState({}, "", "/");
      // Refresh status to show subscription is active
      const checkAfterCheckout = async () => {
        try {
          const headers: Record<string, string> = {};
          if (userId) headers["Authorization"] = `Bearer ${userId}`;
          const res = await fetch("/api/courses/paywall-status", { headers });
          const data = await res.json();
          if (data.hasSubscription && data.subscriptionStatus === "active") {
            setIsSubscribed(true);
            setSubscriptionPlan(planParam);
            setTrialExpired(false);
            setInGracePeriod(false);
            setGraceExpired(false);
            setShowRenewalReminder(false);
          }
        } catch { /* silent */ }
      };
      setTimeout(checkAfterCheckout, 2000);
    } else if (paymentStatus === "cancelled") {
      window.history.replaceState({}, "", "/");
      // Use setTimeout to avoid calling setState directly in effect
      setTimeout(() => {
        setCheckoutError(lang === "fr" ? "Paiement annulé. Tu peux réessayer." : "Payment cancelled. You can try again.");
      }, 0);
    }
  }, [userId, lang]);

  const suffix = (n: number) => (n > 1 ? (lang === "fr" ? "s" : "s") : "");

  const cannotRenewMessage = useMemo(() => {
    if (isSubscribed && !showRenewalReminder) {
      const name = firstName || "";
      return tx.offers.cannotRenewEarly.replace("{name}", name || (lang === "fr" ? "Bonjour" : "Hey"));
    }
    return null;
  }, [isSubscribed, showRenewalReminder, firstName, lang, tx.offers]);

  // Button disabled logic
  const isButtonDisabled = (plan: string) =>
    loadingPlan === plan ||
    paymentProcessing ||
    (isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired);

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

        {/* ===== PAYMENT SUCCESS BANNER ===== */}
        {paymentSuccess && (
          <div className="max-w-2xl mx-auto mb-8 space-y-3">
            <div className="flex items-start gap-3 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 animate-fade-in">
              <Check className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-bold text-emerald-300">
                  {lang === "fr" ? "Paiement réussi ! 🎉" : "Payment successful! 🎉"}
                </p>
                <p className="text-sm text-emerald-400/70 mt-1">
                  {lang === "fr"
                    ? "Ton abonnement est maintenant actif. Tu as accès à tous les cours."
                    : "Your subscription is now active. You have access to all courses."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== PAYMENT PROCESSING BANNER ===== */}
        {paymentProcessing && !paymentSuccess && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="flex items-center gap-3 p-5 rounded-2xl bg-mauve/10 border border-mauve/30 animate-fade-in">
              <Loader2 className="w-5 h-5 text-mauve-light animate-spin" />
              <p className="text-sm text-mauve-light font-medium">
                {lang === "fr" ? "Confirmation du paiement en cours..." : "Confirming payment..."}
              </p>
            </div>
          </div>
        )}

        {/* ===== STATUS BANNERS ===== */}
        <div className="max-w-2xl mx-auto mb-8 space-y-3">
          {/* Personalized renewal reminder */}
          {showRenewalReminder && getRenewalMessage && (
            <div className={`flex items-start gap-3 p-4 sm:p-5 rounded-2xl border animate-fade-in ${getUrgencyColor()}`}>
              <Clock className={`w-5 h-5 flex-shrink-0 mt-0.5 ${renewalUrgency === "last24hours" || renewalUrgency === "24hours" || renewalUrgency === "3days" ? "text-red-400" : "text-amber-400"}`} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1 opacity-70">
                  {tx.offers.subscriptionEndingSoon}
                </p>
                <p className="text-sm sm:text-base font-medium">{getRenewalMessage}</p>
                {renewalUrgency === "last24hours" && (
                  <p className="text-2xl sm:text-3xl font-extrabold mt-2 tabular-nums tracking-wide">
                    {String(countdown.hours).padStart(2, "0")}:{String(countdown.minutes).padStart(2, "0")}:{String(countdown.seconds).padStart(2, "0")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Grace period */}
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

          {/* Grace expired */}
          {graceExpired && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-red-500/10 border border-red-500/30 animate-fade-in">
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm sm:text-base text-red-200 font-medium">{tx.offers.gracePeriodExpired}</p>
            </div>
          )}

          {/* Trial active */}
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

          {/* Trial expired */}
          {trialExpired && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm sm:text-base text-amber-200 font-medium">{tx.offers.trialExpired}</p>
            </div>
          )}

          {/* Already subscribed (not ending) */}
          {isSubscribed && !showRenewalReminder && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 animate-fade-in">
              <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm sm:text-base text-emerald-200 font-medium">{tx.offers.subscribed}</p>
                {cannotRenewMessage && (
                  <p className="text-xs text-emerald-300/70 mt-1">{cannotRenewMessage}</p>
                )}
              </div>
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
        {!paymentSuccess && (
          <div
            className={`grid gap-6 lg:gap-8 items-start mb-20 grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto`}
          >
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

              {/* CTA Button */}
              {isButtonDisabled("monthly") ? (
                <button
                  disabled
                  className="w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired
                    ? lang === "fr" ? "Plan Actuel" : "Current Plan"
                    : <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {lang === "fr" ? "Chargement..." : "Loading..."}
                      </>}
                </button>
              ) : (
                <button
                  onClick={() => handleCheckout("monthly")}
                  disabled={loadingPlan === "monthly"}
                  className="w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loadingPlan === "monthly" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : null}
                  {lang === "fr" ? "Choisir Mensuel" : "Choose Monthly"}
                </button>
              )}
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

              {tx.landing.pricing.annual.save && (
                <div className="flex justify-end mb-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                    {tx.landing.pricing.annual.save}
                  </span>
                </div>
              )}

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
                <span className="text-3xl sm:text-4xl font-extrabold text-gold">{tx.landing.pricing.annual.price}</span>
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

              {/* CTA Button */}
              {isButtonDisabled("annual") ? (
                <button
                  disabled
                  className="annual-btn-shimmer w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night font-bold opacity-50 cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden"
                >
                  {isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired
                    ? lang === "fr" ? "Plan Actuel" : "Current Plan"
                    : <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {lang === "fr" ? "Chargement..." : "Loading..."}
                      </>}
                </button>
              ) : (
                <button
                  onClick={() => handleCheckout("annual")}
                  disabled={loadingPlan === "annual"}
                  className="annual-btn-shimmer w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night font-bold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden cursor-pointer"
                >
                  {loadingPlan === "annual" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : null}
                  {lang === "fr" ? "Choisir Annuel" : "Choose Annual"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===== BOTTOM NOTE ===== */}
        <div className="text-center pb-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground/50">
              {lang === "fr"
                ? "Paiement 100% sécurisé via PayPal"
                : "100% secure payment via PayPal"}
            </span>
          </div>

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
