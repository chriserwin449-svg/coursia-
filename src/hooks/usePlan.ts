"use client";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";

export function usePlan() {
  const { userPlan, planFeatures, setUserPlan } = useAppStore(useShallow((s) => ({
    userPlan: s.userPlan,
    planFeatures: s.planFeatures,
    setUserPlan: s.setUserPlan,
  })));

  const isPro = userPlan === "pro" || userPlan === "lifetime";
  const isFree = userPlan === "free";

  return { userPlan, planFeatures, isPro, isFree, setUserPlan };
}
