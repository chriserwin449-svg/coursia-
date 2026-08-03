/**
 * Coursia Analytics — facade that re-exports PostHog helpers.
 *
 * Every component should import { trackEvent } from "@/lib/analytics"
 * (the original import path stays the same — zero code changes needed).
 *
 * PostHog initialization lives in src/lib/posthog.tsx ("use client").
 */

export {
  trackEvent,
  identifyUser,
  resetUser,
} from "@/lib/posthog";

/** Backward-compatible type used by existing call-sites. */
export type AnalyticsEventName =
  | "signup"
  | "login"
  | "course_created"
  | "course_created_recovery"
  | "payment_init"
  | "payment_success"
  | "checkout_started"
  | "pricing_viewed"
  | "paywall_hit"
  | "quiz_started"
  | "quiz_completed"
  | "quiz_passed"
  | "course_shared"
  | "invitation_sent"
  | "certificate_earned"
  | "chapter_viewed"
  | "level_unlocked";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  properties?: Record<string, string | number | boolean>;
}
