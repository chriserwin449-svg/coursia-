"use client";

import { useEffect, useCallback, useRef } from "react";
import { BookOpen, Library, Route, Tag } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { trackEvent } from "@/lib/analytics";
import { t } from "@/lib/i18n";
import { useSession } from "@/hooks/useSession";
import Sidebar from "@/components/coursia/Sidebar";
import LandingPage from "@/components/coursia/LandingPage";
import AuthPage from "@/components/coursia/AuthPage";
import CreateCourse from "@/components/coursia/CreateCourse";
import LibraryPage from "@/components/coursia/Library";
import CourseViewer from "@/components/coursia/CourseViewer";
import Journey from "@/components/coursia/Journey";
import OffersPage from "@/components/coursia/OffersPage";
import TopBar from "@/components/coursia/TopBar";
import { PayPalProviderWrapper } from "@/components/coursia/PayPalProvider";

function MobileBottomNav() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const hasNotification = useAppStore((s) => s.hasNotification);

  const NAV_ITEMS = [
    { view: "create" as const, label: tx.nav.create, icon: BookOpen },
    { view: "library" as const, label: tx.nav.library, icon: Library },
    { view: "journey" as const, label: tx.nav.journey, icon: Route },
    { view: "offers" as const, label: tx.nav.offers, icon: Tag },
  ];

  // Show blinking dot when there's a notification and user is NOT on offers page
  const showDot = hasNotification && view !== "offers";

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-night-light/95 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around py-1.5 px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = view === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-2 sm:px-3 rounded-xl transition-all duration-200 cursor-pointer relative ${
                isActive
                  ? "text-mauve-light"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-mauve-light" : ""}`} />
              <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
              {/* Red blinking dot on Offers tab */}
              {item.view === "offers" && showDot && (
                <span className="notification-dot absolute top-1 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AppShell() {
  const view = useAppStore((s) => s.view);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const user = useAppStore((s) => s.user);
  const setAuthToken = useAppStore((s) => s.setAuthToken);
  const userId = useAppStore((s) => s.userId);
  const setHasNotification = useAppStore((s) => s.setHasNotification);
  const notificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore session (validates token with server and restores user data)
  useSession();

  // Restore auth token from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("coursia-auth-token");
      if (savedToken) {
        setAuthToken(savedToken);
      }

      // Restore pending generation from localStorage
      try {
        const stored = localStorage.getItem("coursia-pending-generation");
        if (stored) {
          const parsed = JSON.parse(stored);
          useAppStore.getState().setPendingGeneration(parsed);
          console.log("[appshell] Restored pending generation from localStorage:", parsed.topic);
        }
      } catch { /* ignore */ }
    }
  }, [setAuthToken]);

  // ── Periodic paywall-status check for notification dot ──
  const checkPaywallStatus = useCallback(async () => {
    // Don't re-check if notification was already dismissed this session
    if (useAppStore.getState().notificationDismissed) return;

    const uid = useAppStore.getState().userId;
    if (!uid) {
      useAppStore.getState().setHasNotification(false);
      return;
    }
    try {
      const res = await fetch("/api/courses/paywall-status", {
        headers: { Authorization: `Bearer ${uid}` },
      });
      const data = await res.json();
      // Show notification dot when subscription is ending soon (within RENEWAL_NOTIFY_DAYS) or in grace period
      const hasRenewal = !!(data.showRenewalReminder && data.renewalUrgency && data.renewalUrgency !== "none");
      const hasGracePeriod = !!data.inGracePeriod;
      useAppStore.getState().setHasNotification(hasRenewal || hasGracePeriod);
      // Also update store with fresh subscription data
      useAppStore.getState().setHasSubscription(!!data.hasSubscription);
      useAppStore.getState().setSubscriptionStatus(data.subscriptionStatus || "none");
      useAppStore.getState().setInTrial(!!data.inTrial);
      useAppStore.getState().setTrialDaysRemaining(data.trialDaysRemaining || 0);
      useAppStore.getState().setShowRenewalReminder(hasRenewal);
      useAppStore.getState().setRenewalDaysRemaining(data.renewalDaysRemaining || 0);
    } catch {
      // silent
    }
  }, []);

  // ── Dismiss notification when user navigates to offers page ──
  useEffect(() => {
    if (view === "offers" && useAppStore.getState().hasNotification) {
      useAppStore.getState().setHasNotification(false);
      useAppStore.getState().setNotificationDismissed(true);
    }
  }, [view]);

  useEffect(() => {
    // Check immediately on mount
    checkPaywallStatus();
    // Then every 60 seconds
    notificationIntervalRef.current = setInterval(checkPaywallStatus, 60_000);
    return () => {
      if (notificationIntervalRef.current) clearInterval(notificationIntervalRef.current);
    };
  }, [checkPaywallStatus]);

  // Handle payment success/redirect from legacy redirect flow (webhook backup)
  // The primary flow now uses inline PayPalButtons, but this handles:
  // 1. Webhook-triggered redirects
  // 2. Legacy redirect flow
  // 3. Direct URL access with payment params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const requestId = params.get("request_id");

    if (paymentStatus === "success") {
      const lang = useAppStore.getState().lang;

      // Clean URL immediately
      window.history.replaceState({}, "", window.location.pathname);

      const capturePayment = async () => {
        try {
          if (requestId) {
            const res = await fetch("/api/subscription/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requestId }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
              const paymentTx = t(lang);
              const message = paymentTx.payment.success;
              useAppStore.getState().setShowCelebration(true);
              useAppStore.getState().setCelebrationMessage(message);
              trackEvent({ name: "payment_success", properties: { method: "redirect" } });
              console.log("[payment] Redirect capture successful, plan:", data.plan);

              // Update store subscription state
              useAppStore.getState().setHasSubscription(true);
              useAppStore.getState().setSubscriptionStatus("active");
            } else {
              console.warn("[payment] Redirect capture returned:", data.error || res.status);
              // Even if capture fails, the webhook may have handled it
              // Check subscription status
              const uid = useAppStore.getState().userId;
              if (uid) {
                try {
                  const pwRes = await fetch("/api/courses/paywall-status", {
                    headers: { Authorization: `Bearer ${uid}` },
                  });
                  const pwData = await pwRes.json();
                  if (pwData.hasSubscription && pwData.subscriptionStatus === "active") {
                    const paymentTx = t(lang);
                    const message = paymentTx.payment.success;
                    useAppStore.getState().setShowCelebration(true);
                    useAppStore.getState().setCelebrationMessage(message);
                    useAppStore.getState().setHasSubscription(true);
                    useAppStore.getState().setSubscriptionStatus("active");
                    console.log("[payment] Subscription confirmed via paywall-status check");
                  }
                } catch { /* non-critical */ }
              }
            }
          } else {
            // No requestId — just show success (webhook might handle it)
            const paymentTx = t(lang);
            const message = paymentTx.payment.success;
            useAppStore.getState().setShowCelebration(true);
            useAppStore.getState().setCelebrationMessage(message);
            trackEvent({ name: "payment_success", properties: { method: "webhook_fallback" } });
          }
        } catch (err) {
          console.error("[payment] Redirect capture error:", err);
          const paymentTx = t(lang);
          const message = paymentTx.payment.connectionError;
          useAppStore.getState().setShowCelebration(true);
          useAppStore.getState().setCelebrationMessage(message);
        }
      };

      capturePayment();

      // Check for pending course generation to auto-resume
      const pending = useAppStore.getState().pendingGeneration;
      const isAuthenticated = useAppStore.getState().isAuthenticated;
      if (isAuthenticated) {
        if (pending) {
          console.log("[payment] Found pending generation after redirect — navigating to create");
          useAppStore.getState().setPendingGeneration(null);
          setTimeout(() => {
            useAppStore.getState().setView("create");
          }, 2000);
        } else {
          useAppStore.getState().setView("offers");
        }
      } else {
        useAppStore.getState().setView("landing");
      }
    } else if (paymentStatus === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Handle card verification success
    const cardVerified = params.get("card_verified");
    if (cardVerified === "success") {
      const lang = useAppStore.getState().lang;
      const paymentTx = t(lang);
      const message = paymentTx.payment.cardVerified;

      const reqId = params.get("request_id");
      if (reqId) {
        fetch("/api/subscription/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: reqId, plan: "monthly" }),
        }).catch(() => {});
      }

      useAppStore.getState().setShowCelebration(true);
      useAppStore.getState().setCelebrationMessage(message);
      window.history.replaceState({}, "", window.location.pathname);

      const isAuthenticated = useAppStore.getState().isAuthenticated;
      if (isAuthenticated) {
        useAppStore.getState().setView("create");
      } else {
        useAppStore.getState().setView("landing");
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-night">
      {view === "landing" ? (
        <LandingPage />
      ) : view === "auth" ? (
        <AuthPage />
      ) : (
        <PayPalProviderWrapper>
          <div className="min-h-screen">
            <Sidebar />
            {view !== "viewer" && <TopBar />}
            <main
              className={`min-h-screen transition-all duration-300 ease-in-out pb-16 md:pb-0 ${
                collapsed
                  ? "ml-0 md:ml-[72px]"
                  : "ml-0 md:ml-[72px] lg:ml-64"
              }`}
            >
              {view === "create" && <CreateCourse />}
              {view === "library" && <LibraryPage />}
              {view === "viewer" && <CourseViewer />}
              {view === "journey" && <Journey />}
              {view === "offers" && <OffersPage />}
            </main>
            <MobileBottomNav />
          </div>
        </PayPalProviderWrapper>
      )}
    </div>
  );
}