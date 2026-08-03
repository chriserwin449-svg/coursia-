"use client";

/**
 * PostHog Client — analytics initialization and event tracking.
 * This file is the single source of truth for all PostHog client-side operations.
 */

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Provider — wraps children, initializes PostHog, captures pageviews */
/* ------------------------------------------------------------------ */

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const readyRef = useRef(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

    if (key && key !== "phc_YOUR_KEY_HERE") {
      posthog.init(key, {
        api_host: host,
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development") ph.debug();
          readyRef.current = true;
        },
        capture_pageviews: false,
        persistence: "localStorage+cookie",
        respect_dnt: true,
        autocapture: {
          element_allowlist: ["a", "button", "input", "select", "textarea", "label"],
        },
      });
    }
  }, []);

  // Capture pageviews on route change
  useEffect(() => {
    if (!readyRef.current || !pathname) return;
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/*  Event tracking helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Capture a custom event in PostHog.
 * Safe to call from any client component.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(name, properties);
  } catch {
    /* analytics must never crash the app */
  }
  if (process.env.NODE_ENV === "development") {
    console.log(`[posthog] ${name}`, properties ?? "");
  }
}

/**
 * Identify a user in PostHog. Call after login.
 */
export function identifyUser(
  userId: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined") return;
  try {
    posthog.identify(userId, properties);
  } catch {
    /* ignore */
  }
}

/**
 * Reset the PostHog identity. Call after logout.
 */
export function resetUser(): void {
  if (typeof window === "undefined") return;
  try {
    posthog.reset();
  } catch {
    /* ignore */
  }
}
