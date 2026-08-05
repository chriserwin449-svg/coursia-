"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { BookOpen, Library, Route, Tag, Menu, X, LogOut, User, AlertTriangle, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore, type AppView } from "@/lib/store";
import { trackEvent } from "@/lib/analytics";
import { t } from "@/lib/i18n";
import { useSession } from "@/hooks/useSession";
import Sidebar from "@/components/coursia/Sidebar";
import CoursiaLogo from "@/components/coursia/CoursiaLogo";
import LandingPage from "@/components/coursia/LandingPage";
import AuthPage from "@/components/coursia/AuthPage";
import CreateCourse from "@/components/coursia/CreateCourse";
import LibraryPage from "@/components/coursia/Library";
import CourseViewer from "@/components/coursia/CourseViewer";
import Journey from "@/components/coursia/Journey";
import OffersPage from "@/components/coursia/OffersPage";
import TopBar from "@/components/coursia/TopBar";
import LegalPage from "@/components/coursia/LegalPage";


function MobileSlideOver({ open, onClose }: { open: boolean; onClose: () => void }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setAuthToken = useAppStore((s) => s.setAuthToken);

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const NAV_ITEMS = [
    { view: "create" as const, label: tx.nav.create, icon: BookOpen },
    { view: "library" as const, label: tx.nav.library, icon: Library },
    { view: "journey" as const, label: tx.nav.journey, icon: Route },
    { view: "offers" as const, label: tx.nav.offers, icon: Tag },
  ];

  const handleNavClick = (viewName: string) => {
    setView(viewName as AppView);
    onClose();
  };

  const confirmLogout = () => {
    setShowLogoutDialog(false);
    setUser(null);
    setAuthToken(null);
    setView("landing");
    onClose();
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(lang === "fr" ? "Format non supporté." : "Unsupported format.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(lang === "fr" ? "Fichier trop volumineux. Max 2 Mo." : "File too large. Max 2MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      formData.append("userId", user.id);

      const res = await fetch("/api/users/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setUser({ ...user, avatar: data.avatarUrl });
        toast.success(lang === "fr" ? "Photo mise à jour !" : "Photo updated!");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || (lang === "fr" ? "Erreur." : "Error."));
      }
    } catch {
      toast.error(lang === "fr" ? "Erreur réseau." : "Network error.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <aside className="fixed left-0 top-0 h-full w-[280px] max-w-[80vw] z-50 bg-night-light border-r border-border flex flex-col md:hidden animate-slide-in-left overflow-hidden">
        {/* Header with logo + close */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <CoursiaLogo size={32} className="flex-shrink-0" />
            <span className="text-lg font-extrabold gradient-text whitespace-nowrap">
              {tx.app.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = view === item.view;
            return (
              <button
                key={item.view}
                onClick={() => handleNavClick(item.view)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-mauve/20 text-mauve-light glow-mauve"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-mauve-light" : ""}`} />
                <span className="text-base font-semibold truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-2 py-3 border-t border-border space-y-1">
          {user && (
            <div
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-muted-foreground/70 cursor-pointer group"
              onClick={handleAvatarClick}
              title={lang === "fr" ? "Changer la photo" : "Change photo"}
            >
              <div className="relative flex-shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.firstName} className="w-8 h-8 rounded-xl object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-mauve/15 flex items-center justify-center">
                    <User className="w-4 h-4 text-mauve-light" />
                  </div>
                )}
                <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">
                  {user.firstName} {(user.lastName || "").charAt(0) || ""}.
                </p>
                <p className="text-[10px] text-muted-foreground/50 truncate">{user.email}</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
            </div>
          )}
          <button
            onClick={() => setShowLogoutDialog(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-semibold truncate">{tx.nav.logout}</span>
          </button>
        </div>
      </aside>

      {/* Logout confirmation dialog */}
      {showLogoutDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-night/80 backdrop-blur-sm animate-fade-in md:hidden"
          onClick={() => setShowLogoutDialog(false)}
        >
          <div
            className="bg-night-light border border-border rounded-3xl w-full max-w-sm mx-4 p-8 animate-fade-in-slide-up text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-xl font-extrabold text-foreground mb-3">
              {tx.nav.logoutConfirm}
            </h3>
            <p className="text-sm text-muted-foreground mb-8">
              {lang === "fr"
                ? "Ta progression est sauvegardée. Tu pourras te reconnecter plus tard."
                : "Your progress is saved. You can log back in later."}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmLogout}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-destructive to-red-600 text-white font-bold text-sm hover:from-red-500 hover:to-red-700 transition-all duration-300 cursor-pointer shadow-lg shadow-destructive/20"
              >
                {tx.nav.logoutYes}
              </button>
              <button
                onClick={() => setShowLogoutDialog(false)}
                className="w-full py-3.5 rounded-full glass text-foreground font-bold text-sm hover:bg-white/10 transition-all duration-300 cursor-pointer"
              >
                {tx.nav.logoutNo}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AppShell() {
  const view = useAppStore((s) => s.view);
  const legalPage = useAppStore((s) => s.legalPage);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const user = useAppStore((s) => s.user);
  const setAuthToken = useAppStore((s) => s.setAuthToken);
  const userId = useAppStore((s) => s.userId);
  const setHasNotification = useAppStore((s) => s.setHasNotification);
  const notificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

      // ── Handle invitation link param ──
      const params = new URLSearchParams(window.location.search);
      const inviteCode = params.get("invite");
      if (inviteCode) {
        // Store invite code in localStorage for later use
        localStorage.setItem("coursia-pending-invite", inviteCode);
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [setAuthToken]);

  // ── Handle pending invite: if authenticated user has a pending invite, process it ──
  useEffect(() => {
    const pendingInvite = typeof window !== "undefined" ? localStorage.getItem("coursia-pending-invite") : null;
    if (!pendingInvite || !userId) return;

    const processInvite = async () => {
      try {
        // First accept the invitation (creates CourseShare)
        const acceptRes = await fetch(`/api/invite/${pendingInvite}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${userId}` },
        });
        const acceptData = await acceptRes.json();

        if (acceptRes.ok && acceptData.courseId) {
          // Clear pending invite
          localStorage.removeItem("coursia-pending-invite");
          // Navigate directly to the course viewer
          useAppStore.getState().setSelectedCourseId(acceptData.courseId);
          useAppStore.getState().setView("viewer");
          console.log("[appshell] Invite accepted, opened course:", acceptData.courseId);
        } else {
          // Failed to accept — if user not logged in yet, will be handled after auth
          console.log("[appshell] Invite accept failed or not yet authenticated:", acceptData.error);
        }
      } catch (err) {
        console.error("[appshell] Error processing invite:", err);
      }
    };

    // Small delay to ensure session is restored first
    const timer = setTimeout(processInvite, 1500);
    return () => clearTimeout(timer);
  }, [userId]);

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

      // Smart notification message
      const currentLang = useAppStore.getState().lang;
      let msg = "";
      if (data.paywallReason === "free_available") {
        // No notification for free course — let user discover naturally
      } else if (data.paywallReason === "free_limit") {
        msg = currentLang === "fr" ? "🚀 Débloque les cours illimités avec Premium." : "🚀 Unlock unlimited courses with Premium.";
      } else if (data.paywallReason === "subscribed" && data.showRenewalReminder) {
        const days = data.renewalDaysRemaining || 0;
        if (days <= 1) {
          msg = currentLang === "fr" ? "🚨 Dernier jour avant expiration." : "🚨 Last day before expiration.";
        } else if (days <= 3) {
          msg = currentLang === "fr" ? "⚠️ Plus que 3 jours avant la fin." : "⚠️ Only 3 days left.";
        } else if (days <= 7) {
          msg = currentLang === "fr" ? "⏳ Ton abonnement expire dans 7 jours." : "⏳ Subscription expires in 7 days.";
        }
      } else if (data.paywallReason === "grace_period" || data.paywallReason === "grace_expired") {
        msg = currentLang === "fr" ? "Ton abonnement est terminé. Réactive Premium." : "Your subscription ended. Reactivate Premium.";
      } else if (data.paywallReason === "subscribed") {
        msg = currentLang === "fr" ? "✨ Premium actif." : "✨ Premium active.";
      }
      useAppStore.getState().setNotificationMessage(msg);
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

  // Handle payment success/redirect from PayPal subscription flow
  // PayPal redirects back with: ?payment=success&plan=xxx&request_id=xxx
  // PayPal may also append: subscription_id=I-XXXX or ba_token=BA-XXXX
  // If neither is present, we look up the subscription via the request_id.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const requestId = params.get("request_id");
    const planFromUrl = params.get("plan");

    if (paymentStatus === "success") {
      const lang = useAppStore.getState().lang;
      // PayPal may return subscription_id, ba_token, or neither
      const subscriptionId = params.get("subscription_id") || params.get("ba_token");

      // Clean URL immediately
      window.history.replaceState({}, "", window.location.pathname);

      const activateAndNavigate = async () => {
        const uid = useAppStore.getState().userId;
        let activationSucceeded = false;
        let activatedPlan = planFromUrl || "monthly";

        if (uid) {
          // Step 1: Activate subscription via API
          const subId = subscriptionId || (requestId ? `lookup:${requestId}` : null);
          if (subId) {
            try {
              const res = await fetch("/api/subscription/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  subscriptionId: subId,
                  userId: uid,
                  requestId: requestId || undefined,
                }),
              });
              const data = await res.json();

              if (res.ok && data.success) {
                trackEvent({ name: "payment_success", properties: { method: "subscription", plan: data.plan, alreadyActive: data.alreadyActive } });
                console.log("[payment] Subscription activated, plan:", data.plan, "alreadyActive:", data.alreadyActive);

                // Update store subscription state
                useAppStore.getState().setHasSubscription(true);
                useAppStore.getState().setSubscriptionStatus("active");
                useAppStore.getState().setUserPlan(data.plan || activatedPlan);

                activationSucceeded = true;
                activatedPlan = data.plan || activatedPlan;

                // Show success toast
                const msg = data.alreadyActive
                  ? (lang === "fr" ? "Paiement confirmé ! Ton abonnement est actif." : "Payment confirmed! Your subscription is active.")
                  : (lang === "fr" ? "Abonnement activé ! 🎉 Bienvenue dans Coursia Premium." : "Subscription activated! 🎉 Welcome to Coursia Premium.");
                const desc = lang === "fr" ? "Tu peux maintenant créer des cours illimités." : "You can now create unlimited courses.";
                toast.success(msg, { duration: 6000, description: desc });
              } else {
                console.warn("[payment] Activate failed:", data.error || res.status);
              }
            } catch (err) {
              console.error("[payment] Activation error:", err);
            }
          }

          // Step 2: If direct activation failed, try paywall-status fallback
          if (!activationSucceeded) {
            try {
              const pwRes = await fetch("/api/courses/paywall-status", {
                headers: { Authorization: `Bearer ${uid}` },
              });
              const pwData = await pwRes.json();
              if (pwData.hasSubscription && pwData.subscriptionStatus === "active") {
                activationSucceeded = true;
                activatedPlan = pwData.subscriptionPlan || activatedPlan;
                useAppStore.getState().setHasSubscription(true);
                useAppStore.getState().setSubscriptionStatus("active");
                useAppStore.getState().setUserPlan(activatedPlan);
                console.log("[payment] Subscription confirmed via paywall-status");
                toast.success(
                  lang === "fr" ? "Paiement réussi ! Ton abonnement est actif. ✅" : "Payment successful! Your subscription is active. ✅",
                  { duration: 6000 }
                );
              }
            } catch { /* ignore */ }
          }

          // Step 3: If still not activated, show "verifying" message
          if (!activationSucceeded) {
            toast.warning(
              lang === "fr" ? "Paiement en cours de vérification…" : "Payment is being verified…",
              { duration: 8000, description: lang === "fr" ? "Ton abonnement s'activera automatiquement." : "Your subscription will activate automatically." }
            );
          }
        } else {
          // No userId — show message
          toast.info(
            lang === "fr" ? "Paiement reçu ! Connecte-toi pour activer." : "Payment received! Sign in to activate.",
            { duration: 6000 }
          );
        }

        // Step 4: Navigate to the correct page
        const isAuthenticated = useAppStore.getState().isAuthenticated;
        const pending = useAppStore.getState().pendingGeneration;
        if (isAuthenticated) {
          // Check if user was in middle of a quiz (saved answers in localStorage)
          let savedQuizCourseId: string | null = null;
          let savedQuizLevel: number | null = null;
          if (typeof window !== "undefined") {
            for (let i = 0; i < window.localStorage.length; i++) {
              const key = window.localStorage.key(i);
              if (key && key.startsWith("coursia-quiz-answers-")) {
                // Extract courseId and level from key: coursia-quiz-answers-{courseId}-level-{level}
                const parts = key.replace("coursia-quiz-answers-", "").split("-level-");
                if (parts.length === 2) {
                  savedQuizCourseId = parts[0];
                  savedQuizLevel = parseInt(parts[1], 10);
                  break;
                }
              }
            }
          }

          if (savedQuizCourseId) {
            // User was blocked mid-quiz — navigate back to their course
            useAppStore.getState().setSelectedCourseId(savedQuizCourseId);
            setTimeout(() => useAppStore.getState().setView("viewer"), 1500);
          } else if (pending) {
            // User tried to generate a course before paying — resume it
            useAppStore.getState().setPendingGeneration(null);
            setTimeout(() => useAppStore.getState().setView("create"), 1500);
          } else {
            // Navigate to library to see their course
            setTimeout(() => useAppStore.getState().setView("library"), 1500);
          }
        } else {
          useAppStore.getState().setView("landing");
        }
      };

      // Run activation then navigate (awaited)
      activateAndNavigate();
    } else if (paymentStatus === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Handle card verification success
    const cardVerified = params.get("card_verified");
    if (cardVerified === "success") {
      const message = lang === "fr" ? "Carte vérifiée avec succès !" : "Card verified successfully!";

      const reqId = params.get("request_id");
      if (reqId) {
        fetch("/api/subscription/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: reqId, plan: "card_verify" }),
        }).catch(() => {});
      }

      toast.success(message, { duration: 5000 });
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
      {legalPage ? (
        <LegalPage type={legalPage} />
      ) : view === "landing" ? (
        <LandingPage />
      ) : view === "auth" ? (
        <AuthPage />
      ) : (
        <div className="min-h-screen">
          <Sidebar />
          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden fixed top-0 left-0 z-30 p-3 hover:bg-white/5 transition-all cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6 text-foreground" />
          </button>
          {view !== "viewer" && <TopBar />}
          <MobileSlideOver open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
          <main
            className={`min-h-screen transition-all duration-300 ease-in-out pb-0 ${
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
        </div>
      )}
    </div>
  );
}