"use client";

/**
 * PostHog Client — analytics initialization and event tracking.
 * Loads the PostHog key from:
 *   1. NEXT_PUBLIC_POSTHOG_KEY env var (highest priority)
 *   2. /api/posthog-public-key endpoint (database-stored config)
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

  // Initialize PostHog
  useEffect(() => {
    const envKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const envHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    function doInit(key: string, host: string) {
      posthog.init(key, {
        api_host: host,
        loaded: () => {
          if (process.env.NODE_ENV === "development") posthog.debug();
          readyRef.current = true;
          console.log(`[posthog] ✅ Connected — key=${key.substring(0, 12)}… host=${host}`);
        },
        capture_pageviews: false,
        persistence: "localStorage+cookie",
        respect_dnt: true,
        autocapture: {
          element_allowlist: ["a", "button", "input", "select", "textarea", "label"],
        },
      });
    }

    // If valid key in env, use it directly
    if (envKey && envKey.startsWith("phc_")) {
      doInit(envKey, envHost || "https://us.i.posthog.com");
      return;
    }

    // Otherwise, fetch from database
    fetch("/api/posthog-public-key")
      .then((res) => res.json())
      .then((data) => {
        if (data.key && typeof data.key === "string" && data.key.startsWith("phc_")) {
          doInit(data.key, data.host || "https://us.i.posthog.com");
        }
      })
      .catch(() => {
        // Silently fail — analytics must never break the app
      });
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
    console.log(`[posthog] 📊 ${name}`, properties ?? "");
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
