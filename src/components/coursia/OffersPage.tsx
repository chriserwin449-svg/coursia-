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
  X,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";

// ─── Payment Modal Component ─────────────────────────────────────────────

function PaymentModal({
  plan,
  lang,
  onClose,
  onSuccess,
}: {
  plan: "monthly" | "annual";
  lang: "fr" | "en";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const tx = t(lang);
  const userId = useAppStore((s) => s.userId);
  const [{ isPending, isResolved, isRejected }] = usePayPalScriptReducer();

  const [step, setStep] = useState<"idle" | "creating" | "paying" | "capturing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const capturingRef = useRef(false);

  const planInfo = plan === "monthly"
    ? { name: tx.landing.pricing.monthly.name, price: tx.landing.pricing.monthly.price, period: tx.landing.pricing.monthly.period }
    : { name: tx.landing.pricing.annual.name, price: tx.landing.pricing.annual.price, period: tx.landing.pricing.annual.period };

  // createOrder callback — called by PayPalButtons when user initiates payment
  const createOrder = useCallback(async (): Promise<string> => {
    console.log("[paypal-modal] createOrder called for plan:", plan);

    // Prevent double creation
    if (step === "creating" || step === "paying" || step === "capturing") {
      console.warn("[paypal-modal] Blocking duplicate createOrder");
      throw new Error("Payment already in progress");
    }

    setStep("creating");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId }),
      });

      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(lang === "fr" ? "Impossible de se connecter au service de paiement. Vérifie ton Wi-Fi." : "Can't reach the payment service. Check your Wi-Fi.");
      }

      if (!res.ok) {
        const code = data.code as string | undefined;
        if (code === "PAYPAL_NOT_CONFIGURED") {
          throw new Error(lang === "fr" ? "Le paiement n'est pas encore configuré. Reviens bientôt !" : "Payments aren't ready yet. Check back soon!");
        }
        if (res.status === 404) {
          throw new Error(lang === "fr" ? "Compte introuvable. Connecte-toi d'abord." : "Account not found. Please sign in first.");
        }
        if (res.status === 429) {
          throw new Error(lang === "fr" ? "Tu cliques un peu trop vite ! Attends une minute et réessaie." : "A bit too fast! Wait a minute and try again.");
        }
        if (res.status === 400 && String(data.error).includes("Already subscribed")) {
          throw new Error(lang === "fr" ? "Tu as déjà un abonnement actif !" : "You already have an active subscription!");
        }
        throw new Error(String(data.error || data.details || (lang === "fr" ? "Un souci technique. Réessaie dans un instant." : "Something went wrong. Try again in a moment.")));
      }

      const orderId = String(data.orderId || "");
      if (data.requestId) setRequestId(String(data.requestId));

      if (!orderId) {
        throw new Error(lang === "fr" ? "Impossible de préparer le paiement. Réessaie." : "Couldn't prepare the payment. Try again.");
      }

      console.log("[paypal-modal] Order created:", orderId.substring(0, 12) + "...");
      setStep("paying");
      trackEvent({ name: "payment_init", properties: { plan, method: "inline" } });
      return orderId;
    } catch (err) {
      console.error("[paypal-modal] createOrder error:", err);
      const msg = err instanceof Error ? err.message : (lang === "fr" ? "Erreur inconnue." : "Unknown error.");
      setErrorMessage(msg);
      setStep("error");
      throw err; // Re-throw so PayPal shows error state
    }
  }, [plan, userId, lang, step]);

  // onApprove callback — called by PayPalButtons when user approves payment
  const onApprove = useCallback(async (): Promise<void> => {
    console.log("[paypal-modal] onApprove called");

    // Prevent double capture
    if (capturingRef.current) {
      console.warn("[paypal-modal] Blocking duplicate capture");
      return;
    }
    capturingRef.current = true;
    setStep("capturing");

    try {
      if (!requestId) {
        console.error("[paypal-modal] No requestId available for capture");
        // Try to continue — webhook may handle it
        setStep("success");
        onSuccess();
        return;
      }

      const res = await fetch("/api/subscription/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        console.log("[paypal-modal] Payment captured successfully, plan:", data.plan);
        setStep("success");
        trackEvent({ name: "payment_success", properties: { plan, method: "inline" } });
        onSuccess();
      } else {
        // Capture failed — but payment may have been approved via webhook
        console.warn("[paypal-modal] Capture returned:", data.error || res.status);

        // If it's "already active", still treat as success
        if (data.alreadyActive) {
          console.log("[paypal-modal] Subscription already active — treating as success");
          setStep("success");
          onSuccess();
          return;
        }

        // For other errors, show success anyway (webhook will handle activation)
        // The user already paid — we should not block them
        console.log("[paypal-modal] Payment was approved by user, capture had issue — allowing success (webhook backup)");
        setStep("success");
        onSuccess();
      }
    } catch (err) {
      console.error("[paypal-modal] onApprove error:", err);
      // User has already paid — don't block them
      console.log("[paypal-modal] Network error during capture — allowing success (webhook backup)");
      setStep("success");
      onSuccess();
    } finally {
      capturingRef.current = false;
    }
  }, [requestId, lang, onSuccess]);

  // onError callback — called by PayPalButtons when PayPal SDK encounters an error
  const onError = useCallback((err: Record<string, unknown>) => {
    console.error("[paypal-modal] PayPal SDK error:", err);
    if (step !== "success") {
      setErrorMessage(lang === "fr"
        ? "PayPal a rencontré un problème. Réessaie dans un instant."
        : "PayPal ran into an issue. Try again in a moment.");
      setStep("error");
    }
    trackEvent({ name: "payment_error", properties: { plan, error: "sdk_error" } });
  }, [lang, plan, step]);

  // onCancel callback — called when user closes PayPal popup
  const onCancel = useCallback(() => {
    console.log("[paypal-modal] Payment cancelled by user");
    setStep("idle");
    trackEvent({ name: "payment_cancelled", properties: { plan } });
  }, [plan]);

  // Close handler
  const handleClose = useCallback(() => {
    if (step === "capturing") {
      // Don't allow closing during capture
      return;
    }
    trackEvent({ name: "payment_modal_closed", properties: { plan, step } });
    onClose();
  }, [step, plan, onClose]);

  // Show success state briefly, then close
  useEffect(() => {
    if (step === "success") {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md glass rounded-3xl p-6 sm:p-8 shadow-2xl shadow-mauve/20 animate-fade-in-slide-up">
        {/* Close button */}
        {step !== "success" && step !== "capturing" && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 transition-colors duration-200 cursor-pointer"
            aria-label={lang === "fr" ? "Fermer" : "Close"}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}

        {/* ─── IDLE / CREATING / PAYING STATE ─── */}
        {(step === "idle" || step === "creating" || step === "paying") && (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-mauve to-gold flex items-center justify-center shadow-lg shadow-mauve/30">
                {plan === "annual"
                  ? <Crown className="w-7 h-7 text-white" />
                  : <Zap className="w-7 h-7 text-white" />}
              </div>
              <h3 className="text-xl font-bold mb-1">
                {planInfo.name}
              </h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-extrabold">{planInfo.price}</span>
                <span className="text-muted-foreground">{planInfo.period}</span>
              </div>
            </div>

            {/* Security badge */}
            <div className="flex items-center justify-center gap-2 mb-6 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{lang === "fr" ? "Paiement sécurisé par PayPal" : "Secure payment by PayPal"}</span>
            </div>

            {/* PayPal Buttons */}
            <div className="space-y-3">
              {(isPending || step === "creating") ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="w-8 h-8 text-mauve-light animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    {lang === "fr" ? "Création de la commande..." : "Creating order..."}
                  </p>
                </div>
              ) : (
                <>
                  <PayPalButtons
                    style={{
                      layout: "vertical",
                      color: "gold",
                      shape: "rect",
                      label: "pay",
                      height: 48,
                      tagline: false,
                    }}
                    disabled={step !== "idle" && step !== "error"}
                    createOrder={createOrder}
                    onApprove={onApprove}
                    onError={onError}
                    onCancel={onCancel}
                  />

                  {/* Card payment hint */}
                  <p className="text-center text-xs text-muted-foreground/70 mt-1">
                    <CreditCard className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                    {lang === "fr"
                      ? "PayPal affiche aussi le paiement par carte bancaire"
                      : "PayPal also shows debit/credit card payment"}
                  </p>
                </>
              )}
            </div>

            {/* Retry button on error */}
            {step === "error" && !isPending && (
              <button
                onClick={() => { setStep("idle"); setErrorMessage(null); }}
                className="w-full mt-4 py-3 rounded-2xl glass text-muted-foreground font-semibold text-sm hover:text-foreground hover:bg-white/5 transition-all duration-200 cursor-pointer"
              >
                {lang === "fr" ? "Réessayer" : "Try again"}
              </button>
            )}

            {/* Cancel link */}
            {step === "idle" && (
              <button
                onClick={handleClose}
                className="w-full mt-4 py-2 text-muted-foreground/60 text-sm hover:text-muted-foreground transition-colors cursor-pointer"
              >
                {lang === "fr" ? "Annuler" : "Cancel"}
              </button>
            )}
          </>
        )}

        {/* ─── CAPTURING STATE ─── */}
        {step === "capturing" && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 text-mauve-light animate-spin mx-auto mb-4" />
            <p className="text-base font-semibold text-foreground">
              {lang === "fr" ? "Confirmation du paiement..." : "Confirming payment..."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === "fr" ? "Ne ferme pas cette page." : "Don't close this page."}
            </p>
          </div>
        )}

        {/* ─── SUCCESS STATE ─── */}
        {step === "success" && (
          <div className="text-center py-6 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-emerald-300 mb-1">
              {lang === "fr" ? "Paiement réussi !" : "Payment successful!"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {lang === "fr"
                ? "Ton abonnement est maintenant actif."
                : "Your subscription is now active."}
            </p>
          </div>
        )}

        {/* ─── ERROR STATE ─── */}
        {step === "error" && errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-200">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

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

  // Payment modal state
  const [paymentModalPlan, setPaymentModalPlan] = useState<"monthly" | "annual" | null>(null);

  // Countdown timer for last 24 hours
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // PayPal configuration check
  const [paypalConfigured, setPaypalConfigured] = useState<boolean | null>(null);
  const [paypalNotConfigured, setPaypalNotConfigured] = useState(false);

  // ─── Open payment modal ────────────────────────────────────────────────
  const openPaymentModal = useCallback((plan: "monthly" | "annual") => {
    if (!isAuthenticated || !userId) {
      setView("auth");
      return;
    }
    if (paypalConfigured === false) return;
    if (isSubscribed && !showRenewalReminder && !inGracePeriod && !graceExpired) return;

    setCheckoutError(null);
    setPaymentModalPlan(plan);
    trackEvent({ name: "payment_modal_opened", properties: { plan } });
  }, [isAuthenticated, userId, paypalConfigured, isSubscribed, showRenewalReminder, inGracePeriod, graceExpired, setView]);

  // ─── Handle payment success from modal ─────────────────────────────────
  const handlePaymentSuccess = useCallback(async () => {
    console.log("[offers] Payment success — refreshing status");

    // Show celebration
    const paymentTx = t(lang);
    const message = paymentTx.payment.success;
    useAppStore.getState().setShowCelebration(true);
    useAppStore.getState().setCelebrationMessage(message);

    // Refresh subscription status
    try {
      const headers: Record<string, string> = {};
      if (userId) headers["Authorization"] = `Bearer ${userId}`;
      const res = await fetch("/api/courses/paywall-status", { headers });
      const data = await res.json();
      if (data.hasSubscription && data.subscriptionStatus === "active") {
        setIsSubscribed(true);
        setSubscriptionPlan(data.subscriptionPlan || paymentModalPlan || "monthly");
        setTrialExpired(false);
        setInGracePeriod(false);
        setGraceExpired(false);
        setShowRenewalReminder(false);

        // Update global store
        useAppStore.getState().setHasSubscription(true);
        useAppStore.getState().setSubscriptionStatus("active");
        useAppStore.getState().setHasNotification(false);
      }
    } catch {
      // Non-critical — celebration already shown
    }

    // Check for pending course generation to auto-resume
    const pending = useAppStore.getState().pendingGeneration;
    if (pending) {
      console.log("[offers] Found pending course generation:", pending.topic);
      useAppStore.getState().setPendingGeneration(null);
      // Navigate to create view — the CreateCourse component will auto-detect
      // the pending generation and trigger it
      setTimeout(() => {
        useAppStore.getState().setView("create");
      }, 1500);
    }
  }, [lang, userId, paymentModalPlan]);

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
          if (!data.configured) setPaypalNotConfigured(true);
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

  // Button disabled logic
  const isButtonDisabled = (plan: string) =>
    paypalConfigured === false ||
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
                onClick={() => openPaymentModal("monthly")}
                className="w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
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
                onClick={() => openPaymentModal("annual")}
                className="annual-btn-shimmer w-full py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night font-bold hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden cursor-pointer"
              >
                {lang === "fr" ? "Choisir Annuel" : "Choose Annual"}
              </button>
            )}
          </div>
        </div>

        {/* ===== BOTTOM NOTE ===== */}
        <div className="text-center pb-10">
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

    {/* ===== PAYMENT MODAL ===== */}
    {paymentModalPlan && (
      <PaymentModal
        plan={paymentModalPlan}
        lang={lang}
        onClose={() => setPaymentModalPlan(null)}
        onSuccess={handlePaymentSuccess}
      />
    )}

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
      @keyframes fade-in-slide-up {
        from { opacity: 0; transform: translateY(20px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .animate-fade-in-slide-up { animation: fade-in-slide-up 0.35s ease-out; }

    `}</style>
    </>
  );
}