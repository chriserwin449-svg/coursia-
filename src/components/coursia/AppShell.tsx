"use client";

import { useEffect, useCallback, useRef } from "react";
import { BookOpen, Library, Route, Tag } from "lucide-react";
import { useAppStore } from "@/lib/store";
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
    }
  }, [setAuthToken]);

  // ── Periodic paywall-status check for notification dot ──
  const checkPaywallStatus = useCallback(async () => {
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
      const hasRenewal = !!(data.showRenewalReminder && data.renewalUrgency && data.renewalUrgency !== "none");
      useAppStore.getState().setHasNotification(hasRenewal);
      // Also update store with fresh subscription data
      useAppStore.getState().setHasSubscription(!!data.hasSubscription);
      useAppStore.getState().setSubscriptionStatus(data.subscriptionStatus || "none");
      useAppStore.getState().setInTrial(!!data.inTrial);
      useAppStore.getState().setTrialDaysRemaining(data.trialDaysRemaining || 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    // Check immediately on mount
    checkPaywallStatus();
    // Then every 60 seconds
    notificationIntervalRef.current = setInterval(checkPaywallStatus, 60_000);
    return () => {
      if (notificationIntervalRef.current) clearInterval(notificationIntervalRef.current);
    };
  }, [checkPaywallStatus]);

  // Handle payment success/redirect
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");

    if (paymentStatus === "success") {
      const lang = useAppStore.getState().lang;
      // Show success message via confetti/celebration
      const message = lang === "fr"
        ? "Paiement réussi ! Ton abonnement est maintenant actif."
        : "Payment successful! Your subscription is now active.";

      useAppStore.getState().setShowCelebration(true);
      useAppStore.getState().setCelebrationMessage(message);

      // Clean URL (remove query params without page reload)
      window.history.replaceState({}, "", window.location.pathname);

      // Redirect to offers page to show active subscription status
      const isAuthenticated = useAppStore.getState().isAuthenticated;
      if (isAuthenticated) {
        useAppStore.getState().setView("offers");
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
            {view === "offers" && (
              <PayPalProviderWrapper>
                <OffersPage />
              </PayPalProviderWrapper>
            )}
          </main>
          <MobileBottomNav />
        </div>
      )}
    </div>
  );
}