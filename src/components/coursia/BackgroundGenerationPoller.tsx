"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useAppStore, type CourseData } from "@/lib/store";
import { trackEvent } from "@/lib/analytics";

/**
 * Global poller that checks for a background course generation completing.
 * Mounted once in AppShell (always present when authenticated).
 *
 * Behaviour:
 * - If `backgroundGeneration` is set in the store, polls /api/courses every 10 s.
 * - Matches by title (case-insensitive).
 * - If course has "__PENDING__" description and NO chapters → still generating, keep waiting.
 * - If course has chapters and real description → generation complete!
 * - Shows a success toast and clears the tracking state.
 * - If the user is on the "create" view, auto-redirects to the viewer.
 * - Gives up after 8 minutes (serverless function timeout is ~300s + safety margin).
 */
export default function BackgroundGenerationPoller() {
  const bg = useAppStore((s) => s.backgroundGeneration);
  const view = useAppStore((s) => s.view);
  const lang = useAppStore((s) => s.lang);
  const setView = useAppStore((s) => s.setView);
  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);
  const setBackgroundGeneration = useAppStore((s) => s.setBackgroundGeneration);
  const setIsGenerating = useAppStore((s) => s.setIsGenerating);
  const setCourses = useAppStore((s) => s.setCourses);
  const setFreeCourseUsed = useAppStore((s) => s.setFreeCourseUsed);
  const setGenerationProgress = useAppStore((s) => s.setGenerationProgress);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    notifiedRef.current = false;

    const POLL_INTERVAL_MS = 8_000; // Poll every 8 seconds
    const MAX_AGE_MS = 8 * 60_000; // 8 minutes (Groq free tier needs ~35s between calls, 6 calls + delays)

    intervalRef.current = setInterval(async () => {
      const pending = useAppStore.getState().backgroundGeneration;
      if (!pending) {
        stopPolling();
        return;
      }

      // Give up if too much time has passed
      const age = Date.now() - pending.startedAt;
      if (age > MAX_AGE_MS) {
        console.log("[bg-poller] Giving up after", Math.round(age / 1000), "s");
        stopPolling();
        setBackgroundGeneration(null);
        setIsGenerating(false);
        toast.error(
          lang === "fr"
            ? "La génération a pris trop de temps. Réessaie."
            : "Generation took too long. Please try again.",
        );
        return;
      }

      try {
        const res = await fetch(`/api/courses?userId=${pending.userId}`);
        if (!res.ok) return;

        const data = await res.json();
        const list: CourseData[] = (data.courses as CourseData[]) || [];

        // Match by case-insensitive title
        const match = list.find(
          (c) => c.title.toLowerCase() === pending.title.toLowerCase()
        );

        if (!match) {
          console.log("[bg-poller] Course not yet in DB, still waiting...");
          return;
        }

        // Check if still pending — parse __PENDING__|total|done format
        const desc = match.description || '';
        const pendingMatch = desc.match(/^__PENDING__\|(\d+)\|(\d+)$/);
        if (pendingMatch) {
          const total = parseInt(pendingMatch[1], 10);
          const done = parseInt(pendingMatch[2], 10);
          console.log(`[bg-poller] Progress: ${done}/${total} chapters done`);
          setGenerationProgress({ total, done });
          return;
        }

        // Also check by chapter count vs 0 chapters
        const chapterCount = match.chapters?.length || 0;
        if (desc.startsWith('__PENDING__') && chapterCount === 0) {
          console.log('[bg-poller] Course found, still generating (outline phase)...');
          setGenerationProgress({ total: 0, done: 0 });
          return;
        }

        // Course is READY (has chapters and real description)
        console.log("[bg-poller] Course READY:", match.title, `(${match.chapters?.length || 0} chapters)`);
        stopPolling();
        notifiedRef.current = true;
        setBackgroundGeneration(null);
        setIsGenerating(false);
        setGenerationProgress(null);
        // Only mark free course as used for non-subscribers
        if (!useAppStore.getState().hasSubscription) {
          setFreeCourseUsed(true);
        }

        // Refresh courses list in store
        setCourses(list);

        // Show success notification
        toast.success(
          lang === "fr"
            ? `🎉 Cours "${match.title}" prêt !`
            : `🎉 Course "${match.title}" ready!`,
          {
            description:
              lang === "fr"
                ? "Clique pour commencer l'apprentissage."
                : "Click to start learning.",
            action: {
              label: lang === "fr" ? "Voir le cours" : "View course",
              onClick: () => {
                setSelectedCourseId(match.id);
                setView("viewer");
              },
            },
            duration: 10_000,
          }
        );

        // If user is still on the create page, auto-redirect
        const currentView = useAppStore.getState().view;
        if (currentView === "create") {
          setSelectedCourseId(match.id);
          setView("viewer");
        }

        trackEvent({
          name: "course_created_background",
          properties: { title: pending.title, pollDuration: Math.round(age / 1000) },
        });
      } catch (err) {
        // Non-critical: just skip this poll cycle
        console.warn("[bg-poller] Poll error:", err);
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, setBackgroundGeneration, setIsGenerating, setCourses, setFreeCourseUsed, setSelectedCourseId, setView, setGenerationProgress, lang]);

  // Start / stop polling based on bg state
  useEffect(() => {
    if (bg) {
      startPolling();
    } else {
      stopPolling();
    }
    return stopPolling;
  }, [bg, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  // This component renders nothing visible
  return null;
}
