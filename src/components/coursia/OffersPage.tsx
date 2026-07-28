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

// ─── Main OffersPage Component ───────────────────────────────────────────

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
  const [trialCoursesMax] = useState(1);
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
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [expiryWarning48h, setExpiryWarning48h] = useState(false);

  // Direct checkout: tracks which plan button is currently loading
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "annual" | null>(null);

  // Track whether paywall status has loaded (to prevent UI flash)
  const [statusLoaded, setStatusLoaded] = useState(false);

  // Countdown timer for last 24 hours
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // PayPal configuration check
  const [paypalConfigured, setPaypalConfigured] = useState<boolean | null>(null);
  const [paypalNotConfigured, setPaypalNotConfigured] = useState(false);

  // ─── Direct redirect to PayPal checkout ──────────────────────────────
  const handleChoosePlan = useCallback(async (plan: "monthly" | "annual") => {
    if (!isAuthenticated || !userId) {
      setView("auth");
      return;
    }
    if (paypalConfigured !== true) return;
    if (isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired) return;
    if (checkoutLoading) return; // prevent double-click

    setCheckoutError(null);
    setCheckoutLoading(plan);
    trackEvent({ name: "checkout_started", properties: { plan, method: "redirect" } });

    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId, locale: lang === "fr" ? "fr_FR" : "en_US" }),
      });

      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        setCheckoutError(lang === "fr"
          ? "Impossible de se connecter au service de paiement. Vérifie ton Wi-Fi."
          : "Can't reach the payment service. Check your Wi-Fi.");
        setCheckoutLoading(null);
        return;
      }

      if (!res.ok) {
        const code = data.code as string | undefined;
        if (code === "PAYPAL_NOT_CONFIGURED") {
          setCheckoutError(lang === "fr" ? "Le paiement n'est pas encore configuré." : "Payments aren't ready yet.");
        } else if (res.status === 404) {
          setCheckoutError(lang === "fr" ? "Compte introuvable. Connecte-toi d'abord." : "Account not found. Please sign in first.");
        } else if (res.status === 429) {
          setCheckoutError(lang === "fr" ? "Tu cliques un peu trop vite ! Attends une minute." : "A bit too fast! Wait a minute.");
        } else if (res.status === 400 && String(data.error).includes("Already subscribed")) {
          setCheckoutError(lang === "fr" ? "Tu as déjà un abonnement actif !" : "You already have an active subscription!");
        } else {
          setCheckoutError(String(data.details || data.error || (lang === "fr" ? "Un souci technique. Réessaie." : "Something went wrong.")));
        }
        setCheckoutLoading(null);
        return;
      }

      const approveUrl = String(data.approveUrl || "");
      if (!approveUrl) {
        setCheckoutError(lang === "fr" ? "Impossible de préparer le paiement. Réessaie." : "Couldn't prepare the payment. Try again.");
        setCheckoutLoading(null);
        return;
      }

      // Redirect directly to PayPal — no modal, no detour
      console.log("[offers] Redirecting to PayPal for plan:", plan);
      window.location.href = approveUrl;
    } catch (err) {
      console.error("[offers] Checkout error:", err);
      setCheckoutError(lang === "fr" ? "Erreur lors de la préparation du paiement." : "Error preparing payment.");
      setCheckoutLoading(null);
    }
  }, [isAuthenticated, userId, paypalConfigured, isSubscribed, showRenewalReminder, inGracePeriod, graceExpired, setView, checkoutLoading, lang, trackEvent]);

  // Check paywall & subscription status
  useEffect(() => {
    trackEvent({ name: "pricing_viewed" });

    useAppStore.getState().setHasNotification(false);
    useAppStore.getState().setNotificationDismissed(true);

    const checkPayPalConfig = async () => {
      try {
        const res = await fetch("/api/paypal/config");
        if (res.ok) {
          const data = await res.json();
          setPaypalConfigured(!!data.configured);
          if (!data.configured) {
            setPaypalNotConfigured(true);
            console.log("[offers] PayPal not configured. Missing:", data.missing);
          }
        } else {
          setPaypalConfigured(false);
          setPaypalNotConfigured(true);
        }
      } catch {
        setPaypalConfigured(false);
        setPaypalNotConfigured(true);
      }
    };
    checkPayPalConfig();

    const checkStatus = async () => {
      try {
        const headers: Record<string, string> = {};
        if (userId) headers["Authorization"] = `Bearer ${userId}`;

        const res = await fetch("/api/courses/paywall-status", { headers });
        const data = await res.json();

        // Always capture courses generated count
        setTrialCoursesGenerated(data.trialCoursesGenerated || 0);

        if (data.firstName) setFirstName(data.firstName);

        if (data.inTrial) {
          setInTrial(true);
          setTrialDaysRemaining(data.trialDaysRemaining || 0);
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

          // 48h expiry warning
          if (data.expiryWarning48h) {
            setExpiryWarning48h(true);
            useAppStore.getState().setExpiryWarning48h(true);
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
      } finally {
        setStatusLoaded(true);
      }
    };
    checkStatus();
  }, [userId]);

  // Auto-redirect subscribed users (no renewal/grace) to "create" page
  // This ensures that if a user manually navigates to offers while subscribed,
  // they get sent to the create page instead of being stuck on pricing cards
  useEffect(() => {
    if (statusLoaded && isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired && !trialExpired) {
      // Small delay to let the user see the "Premium actif" banner briefly
      const timer = setTimeout(() => {
        setView("create");
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [statusLoaded, isSubscribed, showRenewalReminder, inGracePeriod, graceExpired, trialExpired, setView]);

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
      try {
        const now = Date.now();
        const countdownStart = (typeof window !== "undefined")
          ? (window as unknown as Record<string, number>).__countdownStart || now
          : now;
        const remaining = Math.max(0, timeRemainingMs - (now - countdownStart));

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
      } catch {
        setCountdown({ hours: 0, minutes: 0, seconds: 0 });
      }
    };

    try {
      if (typeof window !== "undefined") {
        (window as unknown as Record<string, number>).__countdownStart = Date.now();
      }
    } catch { /* ignore */ }

    const fetchFreshTime = async () => {
      try {
        const headers: Record<string, string> = {};
        if (userId) headers["Authorization"] = `Bearer ${userId}`;
        const res = await fetch("/api/courses/paywall-status", { headers });
        const data = await res.json();
        if (data.timeRemainingMs) {
          setTimeRemainingMs(data.timeRemainingMs);
          try {
            if (typeof window !== "undefined") {
              (window as unknown as Record<string, number>).__countdownStart = Date.now();
            }
          } catch { /* ignore */ }
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
      const template = (tx.offers as Record<string, string>)[key];
      if (!template) return null;
      return template
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

  const suffix = (n: number) => (n > 1 ? (lang === "fr" ? "s" : "s") : "");

  const cannotRenewMessage = useMemo(() => {
    if (isSubscribed && !showRenewalReminder) {
      const name = firstName || "";
      const template = (tx.offers as Record<string, string>).cannotRenewEarly;
      if (!template) return null;
      return template.replace("{name}", name || (lang === "fr" ? "Bonjour" : "Hey"));
    }
    return null;
  }, [isSubscribed, showRenewalReminder, firstName, lang, tx.offers]);

  // Show "Manage subscription" for active subscribers not in renewal/grace
  const showManageSubscription = statusLoaded && isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired;

  // Button disabled logic
  // While config is loading (null), buttons show loading spinner — not clickable
  const isButtonDisabled = (plan: string) =>
    paypalConfigured === false ||
    paypalConfigured === null ||
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

        {/* ===== NOTIFICATION BANNER ===== */}
        {statusLoaded && isSubscribed && !showRenewalReminder && (
          <div className="mb-8 text-center">
            <p className="text-lg font-bold text-foreground whitespace-pre-line">
              {lang === "fr" ? "✨ Abonnement Premium actif.\nProfite des générations illimitées." : "✨ Premium active.\nEnjoy unlimited generations."}
            </p>
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

          {/* 48h expiry warning banner */}
          {expiryWarning48h && statusLoaded && !graceExpired && (
            <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm sm:text-base text-amber-200 font-medium">
                  {lang === "fr"
                    ? "👋 Ton abonnement arrive bientôt à expiration."
                    : "👋 Your subscription is expiring soon."}
                </p>
                <p className="text-xs text-amber-300/70 mt-1">
                  {lang === "fr"
                    ? "Il expire dans 48 heures. Renouvelle-le maintenant pour continuer à créer tes cours sans interruption."
                    : "It expires in 48 hours. Renew now to keep creating courses without interruption."}
                </p>
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
          <div className={`grid gap-6 lg:gap-8 items-start grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto`}>
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
            {showManageSubscription ? (
              <button
                onClick={() => setView("create")}
                className="w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Crown className="w-5 h-5" />
                {lang === "fr" ? "Gérer mon abonnement" : "Manage subscription"}
              </button>
            ) : isButtonDisabled("monthly") ? (
              <button
                disabled
                className="w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
              >
                {paypalConfigured === false
                  ? (lang === "fr" ? "Bientôt disponible" : "Coming soon")
                  : isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired
                    ? lang === "fr" ? "Plan Actuel" : "Current Plan"
                    : <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {lang === "fr" ? "Chargement..." : "Loading..."}
                      </>}
              </button>
            ) : (
              <button
                onClick={() => handleChoosePlan("monthly")}
                disabled={checkoutLoading !== null}
                className="w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-wait"
              >
                {checkoutLoading === "monthly" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : null}
                {checkoutLoading === "monthly"
                  ? (lang === "fr" ? "Redirection vers PayPal..." : "Redirecting to PayPal...")
                  : (lang === "fr" ? "Choisir ce plan" : "Choose this plan")}
              </button>
            )}
          </div>

          {/* ANNUAL PLAN — highlighted */}
          <div className="pricing-card-float annual-card-shimmer relative glass rounded-3xl p-5 sm:p-8 flex flex-col border-2 border-gold/50 hover:border-gold/70 transition-all duration-300 shadow-[0_0_40px_rgba(234,179,8,0.1)]">
            {/* Popular badge */}
            <span className="annual-badge-pulse absolute -top-4 left-1/2 -translate-x-1/2 px-3 sm:px-5 py-1.5 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night text-[10px] sm:text-xs font-extrabold uppercase tracking-wider z-10 flex items-center gap-1 sm:gap-1.5 overflow-hidden">
              <Crown className="w-3 sm:w-3.5 h-3 sm:h-3.5 flex-shrink-0" />
              <span className="truncate">{tx.landing.pricing.annual.badge}</span>
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
            {showManageSubscription ? (
              <button
                onClick={() => setView("create")}
                className="annual-btn-shimmer w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden cursor-pointer"
              >
                <Crown className="w-5 h-5" />
                {lang === "fr" ? "Gérer mon abonnement" : "Manage subscription"}
              </button>
            ) : isButtonDisabled("annual") ? (
              <button
                disabled
                className="annual-btn-shimmer w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night font-bold opacity-50 cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden"
              >
                {paypalConfigured === false
                  ? (lang === "fr" ? "Bientôt disponible" : "Coming soon")
                  : isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired
                    ? lang === "fr" ? "Plan Actuel" : "Current Plan"
                    : <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {lang === "fr" ? "Chargement..." : "Loading..."}
                      </>}
              </button>
            ) : (
              <button
                onClick={() => handleChoosePlan("annual")}
                disabled={checkoutLoading !== null}
                className="annual-btn-shimmer w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night font-bold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden cursor-pointer disabled:opacity-70 disabled:cursor-wait"
              >
                {checkoutLoading === "annual" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : null}
                {checkoutLoading === "annual"
                  ? (lang === "fr" ? "Redirection vers PayPal..." : "Redirecting to PayPal...")
                  : (lang === "fr" ? "Choisir ce plan" : "Choose this plan")}
              </button>
            )}
          </div>
        </div>

        {/* ===== BOTTOM NOTE ===== */}
        <div className="text-center pb-10 mt-16">
          {paypalNotConfigured && (
            <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold animate-[fadeIn_0.3s_ease-out]">
              ⚙️ {lang === "fr"
                ? "Les paiements seront bientôt disponibles. Reviens vérifier prochainement !"
                : "Payments will be available soon. Check back later!"}
            </div>
          )}
          {!paypalNotConfigured && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground/50">
                {lang === "fr"
                  ? "Paiement sécurisé via PayPal — Carte bancaire ou compte PayPal"
                  : "Secure payment via PayPal — Debit/credit card or PayPal account"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}