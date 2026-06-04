"use client";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";

export function usePlan() {
  const { userPlan, hasSubscription, setUserPlan, setHasSubscription } = useAppStore(
    useShallow((s) => ({
      userPlan: s.userPlan,
      hasSubscription: s.hasSubscription,
      setUserPlan: s.setUserPlan,
      setHasSubscription: s.setHasSubscription,
    }))
  );

  const isPro = hasSubscription;
  const isFree = !hasSubscription;

  return { userPlan, hasSubscription, isPro, isFree, setUserPlan, setHasSubscription };
}
