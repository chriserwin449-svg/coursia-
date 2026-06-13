"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { GRACE_PERIOD_DAYS, STATUS_REFRESH_INTERVAL_MS } from "@/lib/constants";

interface SubscriptionStatusResult {
  trialExpired: boolean;
  inTrial: boolean;
  trialDaysRemaining: number;
  trialCoursesGenerated: number;
  trialCoursesMax: number;
  isSubscribed: boolean;
  subscriptionPlan: string;
  subscriptionEndDate: string | null;
  inGracePeriod: boolean;
  graceDaysRemaining: number;
  graceExpired: boolean;
  showRenewalReminder: boolean;
  renewalDaysRemaining: number;
  renewalUrgency: string;
  firstName: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for fetching and computing subscription/trial status.
 * Eliminates duplication between OffersPage, CreateCourse, and other components.
 */
export function useSubscriptionStatus(): SubscriptionStatusResult {
  const userId = useAppStore((s) => s.userId);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setUserPlan = useAppStore((s) => s.setUserPlan);
  const setHasSubscription = useAppStore((s) => s.setHasSubscription);
  const setSubscriptionStatus = useAppStore((s) => s.setSubscriptionStatus);

  const [trialExpired, setTrialExpired] = useState(false);
  const [inTrial, setInTrial] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [trialCoursesGenerated, setTrialCoursesGenerated] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState("");
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [graceDaysRemaining, setGraceDaysRemaining] = useState(0);
  const [graceExpired, setGraceExpired] = useState(false);
  const [showRenewalReminder, setShowRenewalReminder] = useState(false);
  const [renewalDaysRemaining, setRenewalDaysRemaining] = useState(0);
  const [renewalUrgency, setRenewalUrgency] = useState("none");
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setLoading(false);
      return;
    }

    try {
      const headers: Record<string, string> = {};
      if (userId) headers["Authorization"] = `Bearer ${userId}`;
      const res = await fetch("/api/courses/paywall-status", { headers });
      const data = await res.json();

      const hasSub = data.hasSubscription && data.subscriptionStatus === "active";
      setIsSubscribed(hasSub);
      setSubscriptionPlan(data.subscriptionPlan || "free");
      setSubscriptionEndDate(data.subscriptionEndDate || null);
      setFirstName(data.firstName || "");
      setUserPlan(data.subscriptionPlan || "free");
      setHasSubscription(hasSub);
      setSubscriptionStatus(data.subscriptionStatus || "none");

      const coursesGenerated = data.coursesGenerated || 0;
      const coursesMax = data.trialCoursesMax || 1;
      setTrialCoursesGenerated(coursesGenerated);
      setTrialExpired(!hasSub && coursesGenerated >= coursesMax);
      setInTrial(hasSub || coursesGenerated < coursesMax);
      setTrialDaysRemaining(0);

      // Grace period (3 days after subscription ends)
      if (hasSub && data.subscriptionEndDate) {
        const now = new Date();
        const end = new Date(data.subscriptionEndDate);
        const daysSinceEnd = Math.max(0, Math.floor((now.getTime() - end.getTime()) / 86_400_000));
        const inGrace = daysSinceEnd > 0 && daysSinceEnd <= GRACE_PERIOD_DAYS;
        const graceExpired = daysSinceEnd > GRACE_PERIOD_DAYS;
        setInGracePeriod(inGrace);
        setGraceExpired(graceExpired);
        setGraceDaysRemaining(Math.max(0, GRACE_PERIOD_DAYS - daysSinceEnd));
        setShowRenewalReminder(daysSinceEnd > -7 && !graceExpired);
        setRenewalDaysRemaining(Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000)));
        setRenewalUrgency(
          daysSinceEnd > 0 ? "expired" :
          daysSinceEnd > -3 ? "urgent" :
          daysSinceEnd > -7 ? "warning" : "none"
        );
      } else {
        setInGracePeriod(false);
        setGraceExpired(false);
        setGraceDaysRemaining(0);
      }
    } catch {
      // Silently fail — user can still use the app
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userId, setUserPlan, setHasSubscription, setSubscriptionStatus]);

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, STATUS_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return {
    trialExpired, inTrial, trialDaysRemaining,
    trialCoursesGenerated, trialCoursesMax: 1,
    isSubscribed, subscriptionPlan, subscriptionEndDate,
    inGracePeriod, graceDaysRemaining, graceExpired,
    showRenewalReminder, renewalDaysRemaining, renewalUrgency,
    firstName, loading, refresh: fetchStatus,
  };
}
