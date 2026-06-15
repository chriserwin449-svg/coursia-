/**
 * Coursia Analytics — conversion event tracking.
 * Uses Vercel Analytics custom events.
 * https://vercel.com/docs/analytics/quickstart#tracking-custom-events
 *
 * Events tracked:
 * - signup         → new user registered
 * - login          → user logged in
 * - course_created → course generated
 * - payment_init   → redirected to PayPal
 * - payment_success → returned from PayPal with payment=success
 * - paywall_hit    → free user reached chapter 2
 * - pricing_viewed → user viewed pricing/offers page
 */

type AnalyticsEventName =
  | "signup"
  | "login"
  | "course_created"
  | "payment_init"
  | "payment_success"
  | "paywall_hit"
  | "pricing_viewed";

interface AnalyticsEvent {
  name: AnalyticsEventName;
  /** Optional extra data to attach to the event */
  properties?: Record<string, string | number | boolean>;
}

/**
 * Track a custom analytics event.
 * Works on Vercel (production) and logs to console locally (dev).
 */
export function trackEvent(event: AnalyticsEvent): void {
  // In production on Vercel, the Analytics component captures window.track()
  if (typeof window !== "undefined" && typeof (window as Record<string, unknown>).track === "function") {
    try {
      (window as Record<string, unknown> & { track: (name: string, props?: Record<string, unknown>) => void }).track(event.name, event.properties);
    } catch {
      // Silently fail — analytics should never break the app
    }
  }

  // Also log locally for dev debugging
  if (process.env.NODE_ENV === "development") {
    console.log(`[analytics] ${event.name}`, event.properties || "");
  }
}
