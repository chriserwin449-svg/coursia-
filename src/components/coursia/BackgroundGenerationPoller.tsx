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
 * - When the course appears in the list, shows a success toast and clears the tracking state.
 * - If the user is on the "create" view, auto-redirects to the viewer.
 * - Gives up after 5 minutes (serverless function timeout is ~300 s).
 */
export default function BackgroundGenerationPoller() {
  const bg = useAppStore((s) => s.backgroundGeneration);
  const view = useAppStore((s) => s.view);
  const lang = useAppStore((s) => s.lang);
  const setView = useAppStore((s) => s.setView);
  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);
  const setBackgroundGeneration = useAppStore((s) => s.setBackgroundGeneration);
  const setIsGenerating = useAppStore((s) => s.setIsGenerating);
  const addCourse = useAppStore((s) => s.addCourse);
  const setCourses = useAppStore((s) => s.setCourses);
  const setFreeCourseUsed = useAppStore((s) => s.setFreeCourseUsed);

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

    const POLL_INTERVAL_MS = 10_000;
    const MAX_AGE_MS = 5 * 60_000; // 5 minutes

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
            : "Generation took too long. Please try again."
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

        if (match) {
          console.log("[bg-poller] Course found:", match.title);
          stopPolling();
          notifiedRef.current = true;
          setBackgroundGeneration(null);
          setIsGenerating(false);
          setFreeCourseUsed(true);

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
              duration: 8000,
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
        }
      } catch (err) {
        // Non-critical: just skip this poll cycle
        console.warn("[bg-poller] Poll error:", err);
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, setBackgroundGeneration, setIsGenerating, setCourses, setFreeCourseUsed, setSelectedCourseId, setView, lang]);

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
