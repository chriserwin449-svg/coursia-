"use client";
import { useAppStore } from "@/lib/store";

export function usePlan() {
  const userPlan = useAppStore((s) => s.userPlan);
  const planFeatures = useAppStore((s) => s.planFeatures);
  const setUserPlan = useAppStore((s) => s.setUserPlan);

  const isPro = userPlan === "pro" || userPlan === "lifetime";
  const isFree = userPlan === "free";

  return { userPlan, planFeatures, isPro, isFree, setUserPlan };
}
