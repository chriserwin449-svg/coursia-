"use client";

declare global {
  interface Window { __coursiaLimitTimestamp?: number }
}

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  Sparkles,
  Plus,
  X,
  Link as LinkIcon,
  Loader2,
  BookOpen,
  ChevronRight,
  Globe,
  Crown,
  Gift,
  GraduationCap,
  Clock,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import type { CourseData } from "@/lib/store";

export default function CreateCourse() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const user = useAppStore((s) => s.user);

  const setView = useAppStore((s) => s.setView);
  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);
  const setIsGenerating = useAppStore((s) => s.setIsGenerating);

  const [title, setTitle] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [courseLang, setCourseLang] = useState("fr"); // "fr" or "en"
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [showSuggested, setShowSuggested] = useState(false);
  const [suggestedTopic, setSuggestedTopic] = useState("");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [canCreateCourse, setCanCreateCourse] = useState(false);
  const [paywallLoaded, setPaywallLoaded] = useState(false);
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [localFreeCourseUsed, setLocalFreeCourseUsed] = useState(false);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [dailyResetInMs, setDailyResetInMs] = useState(0);
  const [dailyCoursesToday, setDailyCoursesToday] = useState(0);
  const [dailyLimitTotal, setDailyLimitTotal] = useState(4);
  const [selectedLevel, setSelectedLevel] = useState(0);
  const [isRandomTopic, setIsRandomTopic] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  //  Double-click prevention ref 
  const generatingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  //  Store refs for random topic 
  const storeRandomTopic = useAppStore((s) => s.randomTopic);
  const storeRandomCourseLang = useAppStore((s) => s.randomCourseLang);
  const setStoreRandomTopic = useAppStore((s) => s.setRandomTopic);
  const prevRandomRef = useRef<string | null>(null);

  //  Daily limit countdown timer 
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!dailyLimitReached || dailyResetInMs <= 0) {
      setCountdown("");
      return;
    }
    const update = () => {
      const remaining = Math.max(0, dailyResetInMs - (Date.now() - (window.__coursiaLimitTimestamp || Date.now())));
      if (remaining <= 0) {
        setCountdown("");
        setDailyLimitReached(false);
        fetchCourses(); // Refresh to get updated limits
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      if (h > 0) {
        setCountdown(`${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`);
      } else if (m > 0) {
        setCountdown(`${m}m ${s.toString().padStart(2, "0")}s`);
      } else {
        setCountdown(`${s}s`);
      }
    };
    // Store timestamp when limit was set for accurate countdown
    if (!window.__coursiaLimitTimestamp) {
      (window as unknown as Record<string, number>).__coursiaLimitTimestamp = Date.now();
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dailyLimitReached, dailyResetInMs, fetchCourses]);

  //  React to random topic changes from TopBar (instant, no reload) 
  useEffect(() => {
    if (storeRandomTopic && storeRandomTopic !== prevRandomRef.current) {
      setTitle(storeRandomTopic);
      setSuggestedTopic(storeRandomTopic);
      setShowSuggested(true);
      setIsRandomTopic(true);
      setSelectedLevel(0);
      if (storeRandomCourseLang === "fr" || storeRandomCourseLang === "en") {
        setCourseLang(storeRandomCourseLang);
      }
      prevRandomRef.current = storeRandomTopic;
      setStoreRandomTopic(null); // consume it
    }
  }, [storeRandomTopic, storeRandomCourseLang, setStoreRandomTopic]);

  //  Progress messages: 5 detailed steps 
  const progressMessages = useMemo(() => lang === "fr"
    ? [
        "Préparation du cours...",
        "Analyse du sujet...",
        "Création du plan...",
        "Génération des chapitres...",
        "Finalisation...",
      ]
    : [
        "Preparing course...",
        "Analyzing subject...",
        "Creating outline...",
        "Generating chapters...",
        "Finalizing...",
      ],
    [lang]
  );

  // Simulate step progression based on time elapsed
  useEffect(() => {
    if (!loading) { setGenerationStep(0); return; }
    // Advance through steps: each step ~12-15s (course takes ~60-90s total)
    const stepDurations = [3000, 8000, 18000, 45000, 70000]; // ms thresholds
    const interval = setInterval(() => {
      const elapsed = Date.now() - (progressStartRef.current || Date.now());
      let step = 0;
      for (let i = stepDurations.length - 1; i >= 0; i--) {
        if (elapsed >= stepDurations[i]) { step = i + 1; break; }
      }
      setGenerationStep(Math.min(step, progressMessages.length - 1));
    }, 2000);
    return () => clearInterval(interval);
  }, [loading, progressMessages.length]);

  const progressStartRef = useRef(0);

  //  Personalized greeting (time-based) 
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const firstName = user?.firstName || "";
    const casualGreetings = tx.create.greetingCasual;
    const messages = tx.create.greetingMessages;

    // Pick a greeting based on time of day
    let timeGreeting: string;
    if (hour >= 5 && hour < 12) {
      timeGreeting = tx.create.greetingMorning;
    } else if (hour >= 12 && hour < 17) {
      timeGreeting = tx.create.greetingAfternoon;
    } else if (hour >= 17 && hour < 22) {
      timeGreeting = tx.create.greetingEvening;
    } else {
      // Late night - use a random casual greeting
      timeGreeting = casualGreetings[Math.floor(Math.random() * casualGreetings.length)];
    }

    // Pick a random encouraging message (seeded by day to avoid changing on every render)
    const dayIndex = Math.floor(Date.now() / 86_400_000); // changes once per day
    const message = messages[dayIndex % messages.length];

    return {
      greeting: timeGreeting,
      name: firstName,
      message,
    };
  }, [user?.firstName, tx.create]);

  //  Rotating placeholder with typing/fade effect 
  const placeholders = tx.create.placeholders;
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState(placeholders[0]);
  const [charIndex, setCharIndex] = useState(0);
  // Phase: 'typing' | 'visible' | 'fadingOut' | 'fadingIn'
  const [placeholderPhase, setPlaceholderPhase] = useState<"typing" | "visible" | "fadingOut" | "fadingIn">("typing");
  const timerARef = useRef<ReturnType<typeof setTimeout>>();
  const timerBRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Skip animation while user has typed something
    if (title.length > 0) {
      setDisplayedPlaceholder("");
      setPlaceholderPhase("typing");
      return;
    }

    const currentPlaceholder = placeholders[placeholderIndex];
    const clear = () => { clearTimeout(timerARef.current); clearTimeout(timerBRef.current); };

    switch (placeholderPhase) {
      case "typing": {
        if (charIndex <= currentPlaceholder.length) {
          timerARef.current = setTimeout(() => {
            setDisplayedPlaceholder(currentPlaceholder.slice(0, charIndex));
            setCharIndex(charIndex + 1);
          }, 35);
          return clear;
        } else {
          // Finished typing → show full text briefly
          timerARef.current = setTimeout(() => setPlaceholderPhase("visible"), 1800);
          return clear;
        }
      }

      case "visible": {
        // Start fading out
        timerARef.current = setTimeout(() => setPlaceholderPhase("fadingOut"), 800);
        return clear;
      }

      case "fadingOut": {
        // After fade-out transition (500ms), switch to next placeholder in invisible state
        timerARef.current = setTimeout(() => {
          setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
          setCharIndex(0);
          setDisplayedPlaceholder("");
          setPlaceholderPhase("fadingIn");
        }, 500);
        return clear;
      }

      case "fadingIn": {
        // Wait one frame for opacity-0 to apply, then start typing (which triggers opacity-100)
        timerARef.current = setTimeout(() => {
          setPlaceholderPhase("typing");
        }, 30);
        return clear;
      }
    }
  }, [charIndex, placeholderPhase, placeholderIndex, placeholders, title]);

  //  Fetch courses & subscription status
  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses?userId=${useAppStore.getState().userId || ''}`);
      if (res.ok) {
        const data = await res.json();
        const list = (data.courses as CourseData[]) || [];
        setCourses(list);
      }

      // Check subscription & trial status via paywall-status API
      const userId = useAppStore.getState().userId;
      const headers: Record<string, string> = {};
      if (userId) headers["Authorization"] = `Bearer ${userId}`;
      const pwRes = await fetch("/api/courses/paywall-status", { headers });
      if (pwRes.ok) {
        const pw = await pwRes.json();
        setHasSubscription(!!pw.hasSubscription);
        setInGracePeriod(!!pw.inGracePeriod);
        // canGenerate: default to true if missing (fail-open for new users)
        const canGenerate = pw.canGenerate === true || pw.canGenerate === undefined;
        setCanCreateCourse(canGenerate);
        // Sync freeCourseUsed from database (single source of truth)
        setLocalFreeCourseUsed(!!pw.freeCourseUsed);
        useAppStore.getState().setFreeCourseUsed(!!pw.freeCourseUsed);
        // Sync 48h expiry warning
        useAppStore.getState().setExpiryWarning48h(!!pw.expiryWarning48h);
        // Sync daily limit info
        setDailyLimitReached(!!pw.dailyLimitReached);
        setDailyResetInMs(pw.dailyResetInMs || 0);
        setDailyCoursesToday(pw.coursesToday || 0);
        setDailyLimitTotal(pw.dailyLimit || 4);
      } else {
        // API returned non-OK — fail-open: allow generation, the generate API will do the real check
        console.warn("[fetchCourses] Paywall status returned", pwRes.status, "— defaulting canCreateCourse to true");
        setCanCreateCourse(true);
      }
    } catch (err) {
      // Network error / timeout — fail-open so new users aren't blocked
      console.warn("[fetchCourses] Paywall status fetch failed — defaulting canCreateCourse to true", err);
      setCanCreateCourse(true);
    } finally {
      setPaywallLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  //  Auto-resume pending course generation after payment 
  useEffect(() => {
    const pending = useAppStore.getState().pendingGeneration;
    if (!pending) {
      // Also check localStorage in case store wasn't hydrated yet
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("coursia-pending-generation");
          if (stored) {
            const parsed = JSON.parse(stored);
            useAppStore.getState().setPendingGeneration(parsed);
            return; // Will re-trigger this effect
          }
        } catch { /* ignore */ }
      }
      return;
    }

    // Check if user now has an active subscription before auto-generating
    const checkAndResume = async () => {
      try {
        const userId = useAppStore.getState().userId;
        const headers: Record<string, string> = {};
        if (userId) headers["Authorization"] = `Bearer ${userId}`;
        const res = await fetch("/api/courses/paywall-status", { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.canGenerate || data.hasSubscription) {
            console.log("[create] Auto-resuming pending generation:", pending.topic);
            // Set the form values from pending generation
            setTitle(pending.topic);
            setCourseLang(pending.courseLang);
            setSelectedLevel(pending.level);
            if (pending.isRandom) {
              setIsRandomTopic(true);
              setSuggestedTopic(pending.topic);
              setShowSuggested(true);
            }
            // Clear the pending generation
            useAppStore.getState().setPendingGeneration(null);
            // Trigger generation after a brief delay to let state settle
            setTimeout(() => {
              generateCourse();
            }, 500);
          } else {
            console.log("[create] Pending generation found but user still not subscribed — keeping pending");
          }
        }
      } catch (err) {
        console.error("[create] Error checking subscription for auto-resume:", err);
      }
    };

    // Small delay to ensure store is hydrated
    const timer = setTimeout(checkAndResume, 800);
    return () => clearTimeout(timer);
  }, []);

  //  Do NOT abort generation on unmount — let it continue in the background 
  // The API will finish generating and save the course to the DB even if the user navigates away.
  // The user will see the course in their library when they return.
  // We only abort if the user explicitly starts a new generation (handled in generateCourse via generatingRef).

  //  Clear suggested topic when user modifies title manually 
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (newTitle.trim() !== suggestedTopic.trim()) {
      setShowSuggested(false);
      setSuggestedTopic("");
      setIsRandomTopic(false);
    }
  };

  //  Link management 
  const addLink = () => {
    const trimmed = linkInput.trim();
    if (trimmed && !links.includes(trimmed)) {
      setLinks([...links, trimmed]);
      setLinkInput("");
    }
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  //  User-friendly error classification 
  const getErrorMessage = useCallback((errorType: string, httpStatus: number, detail: string): string => {
    if (lang === "fr") {
      if (httpStatus === 403) return "Tu as atteint ta limite de cours gratuits. Passe à Premium pour en créer autant que tu veux !";
      if (errorType === "RATE_LIMIT") return "Oups, tu as été un peu trop rapide ! Attends quelques secondes et réessaie.";
      if (errorType === "TIMEOUT") return "La génération prend un peu trop de temps cette fois-ci. Réessaie, ça devrait passer.";
      if (errorType === "NETWORK") return "Pas de connexion internet ? Vérifie ton Wi-Fi et réessaie.";
      if (errorType === "AUTH") return "Un petit souci côté serveur. Réessaie dans quelques secondes, ça va marcher.";
      if (errorType === "SERVER") return "Les serveurs sont un peu chargés en ce moment. Reviens dans quelques instants !";
      if (errorType === "PARSE" || errorType === "EMPTY") return "L'IA n'arrive pas à traiter ce sujet. Essaie avec un sujet plus précis ou différent.";
      if (errorType === "AI_GENERATION_FAILED") return "L'IA a eu du mal à structurer ce cours. Réessaie, elle fera mieux la prochaine fois !";
      return "Un imprévu s'est produit. Réessaie, ça devrait fonctionner.";
    } else {
      if (httpStatus === 403) return "You've reached your free course limit. Upgrade to Premium to create unlimited courses!";
      if (errorType === "RATE_LIMIT") return "You're going a bit too fast! Wait a few seconds and try again.";
      if (errorType === "TIMEOUT") return "This one's taking a bit long. Try again — it should go through.";
      if (errorType === "NETWORK") return "Looks like you're offline. Check your Wi-Fi and try again.";
      if (errorType === "AUTH") return "Quick server hiccup. Try again in a few seconds — it'll work.";
      if (errorType === "SERVER") return "Servers are a bit busy right now. Give it a moment and try again!";
      if (errorType === "PARSE" || errorType === "EMPTY") return "AI couldn't process this topic. Try something more specific or different.";
      if (errorType === "AI_GENERATION_FAILED") return "AI had trouble structuring this course. Try again — it'll do better next time!";
      return "Something unexpected happened. Try again — it should work.";
    }
  }, [lang]);

  //  Generate course (with retry, timeout, DB recovery) 
  const generateCourse = async () => {
    // ═══ DOUBLE-CLICK PREVENTION ═══
    if (generatingRef.current) {
      console.log("[generate] Blocked: already generating");
      return;
    }
    if (!title.trim() || loading) return;

    // Validate payload before sending
    const effectiveLevel = isRandomTopic ? 0 : selectedLevel;
    if (effectiveLevel < 0 || effectiveLevel > 2) {
      setError(lang === "fr" ? "Niveau invalide" : "Invalid level");
      return;
    }
    if (!["fr", "en"].includes(courseLang)) {
      setError(lang === "fr" ? "Langue invalide" : "Invalid language");
      return;
    }

    // NOTE: No client-side paywall pre-check here.
    // The server (generate API) is the single source of truth for quota.
    // If the server returns FREE_LIMIT, the error handler below will redirect to offers.

    const generatingTitle = title.trim();
    const payload = {
      title: generatingTitle,
      sourceLinks: links,
      level: effectiveLevel,
      courseLang,
      userId: useAppStore.getState().userId,
    };

    console.log("[generate] Starting generation:", { title: generatingTitle, level: effectiveLevel, lang: courseLang });

    // ═══ SET LOADING STATE ═══
    generatingRef.current = true;
    setLoading(true);
    setError(""); // CRITICAL: Clear error BEFORE any async work
    setIsGenerating(true);
    setGenerationStep(0);
    progressStartRef.current = Date.now();

    // ═══ ABORT CONTROLLER (150s timeout) ═══
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    const FETCH_TIMEOUT_MS = 150_000; // 150 seconds
    const timeoutId = setTimeout(() => abortRef.current?.abort(), FETCH_TIMEOUT_MS);

    const MAX_ATTEMPTS = 3;
    let lastError: string | null = null;
    let lastHttpStatus = 0;
    let lastErrorType = "UNKNOWN";
    let courseRecovered = false;

    // Helper: poll DB to find a course that may have been created in the background
    const pollDbForCourse = async (maxPolls = 5, intervalMs = 3000): Promise<CourseData | null> => {
      for (let p = 0; p < maxPolls; p++) {
        try {
          await new Promise(r => setTimeout(r, p === 0 ? 0 : intervalMs));
          const checkRes = await fetch(`/api/courses?userId=${useAppStore.getState().userId || ''}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const list: CourseData[] = (checkData.courses as CourseData[]) || [];
            const match = list.find((c) => c.title.toLowerCase() === generatingTitle.toLowerCase());
            if (match) return match;
          }
        } catch { /* non-critical */ }
      }
      return null;
    };

    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // Between retries: DB recovery check to avoid duplicate courses
        if (attempt > 0) {
          const backoffMs = 1000 * Math.pow(2, attempt); // 2s, 4s
          console.log(`[generate] Retry ${attempt}/${MAX_ATTEMPTS - 1} in ${backoffMs}ms...`);
          setGenerationStep(0);
          await new Promise(r => setTimeout(r, backoffMs));

          if (signal.aborted) {
            console.log("[generate] Aborted during retry backoff");
            break;
          }

          // Poll DB for the course (the API may have completed in the background)
          const recovered = await pollDbForCourse(2, 2000);
          if (recovered) {
            console.log(`[generate] Course found in DB after failed attempt, recovering: "${recovered.title}"`);
            setCourses(prev => {
              const exists = prev.some(c => c.id === recovered.id);
              return exists ? prev : [recovered, ...prev];
            });
            setSelectedCourseId(recovered.id);
            setView("viewer");
            trackEvent({ name: "course_created_recovery", properties: { title: generatingTitle, attempt: attempt + 1 } });
            courseRecovered = true;
            return;
          }
        }

        try {
          console.log(`[generate] Attempt ${attempt + 1}/${MAX_ATTEMPTS}...`);
          const res = await fetch("/api/courses/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal,
          });

          if (!res.ok) {
            // Try to parse error body for more details
            let errorData: Record<string, unknown> = {};
            try { errorData = await res.json(); } catch { /* ignore parse error */ }

            lastHttpStatus = res.status;
            lastErrorType = (errorData.errorType as string) || "UNKNOWN";
            lastError = (errorData.message as string) || (errorData.error as string) || `HTTP ${res.status}`;

            if (errorData.error === "FREE_LIMIT" || errorData.error === "TRIAL_LIMIT" || errorData.error === "TRIAL_EXPIRED") {
              // Save pending generation for auto-resume after payment
              console.log("[generate] Paywall error from API — saving pending generation");
              useAppStore.getState().setPendingGeneration({
                topic: generatingTitle,
                courseLang,
                level: effectiveLevel,
                isRandom: !!isRandomTopic,
              });
              setView("offers");
              return;
            }

            if (errorData.error === "DAILY_LIMIT") {
              console.log("[generate] Daily limit reached from API");
              setDailyLimitReached(true);
              setDailyResetInMs(errorData.resetInMs || 0);
              setDailyCoursesToday(errorData.coursesToday || 0);
              setDailyLimitTotal(errorData.dailyLimit || 4);
              setError(""); // Clear any other error
              return;
            }

            console.warn(`[generate] Attempt ${attempt + 1} failed (${res.status}): ${lastError}`);
            continue; // retry
          }

          // Parse successful response
          let data: Record<string, unknown>;
          try {
            data = await res.json();
          } catch (parseErr) {
            console.error("[generate] Failed to parse response JSON:", parseErr);
            lastErrorType = "PARSE";
            lastError = "Invalid response from server";
            continue;
          }

          // Handle empty/null AI responses
          if (!data.course) {
            lastErrorType = "EMPTY";
            lastError = "Empty response from server";
            console.warn(`[generate] Attempt ${attempt + 1}: empty course data`);
            continue;
          }

          // ═══ SUCCESS ═══
          const course = data.course as CourseData;
          console.log(`[generate] ✓ Success on attempt ${attempt + 1}: "${course.title}" (${course.chapters?.length || 0} chapters)`);
          // Immediately mark free course as used (reflects the atomic DB flag set before generation)
          setCanCreateCourse(false);
          setLocalFreeCourseUsed(true);
          useAppStore.getState().setFreeCourseUsed(true);
          setSelectedCourseId(course.id);
          setView("viewer");
          trackEvent({ name: "course_created", properties: { plan: String(effectiveLevel), attempt: attempt + 1 } });
          return;
        } catch (err: unknown) {
          if (signal.aborted) {
            console.log("[generate] Request aborted (timeout or user cancel)");
            lastErrorType = "TIMEOUT";
            lastError = "Request timed out";
            break; // Don't retry on abort
          }
          lastError = err instanceof Error ? err.message : "Network error";
          lastErrorType = "NETWORK";
          console.warn(`[generate] Attempt ${attempt + 1} network error: ${lastError}`);
        }
      }

      // All attempts failed — poll DB to find course that may have been created in the background
      console.log("[generate] All attempts failed, polling DB for recovery...");
      const recovered = await pollDbForCourse(5, 3000);
      if (recovered) {
        console.log(`[generate] Final recovery: course "${recovered.title}" found in DB`);
        setCourses(prev => {
          const exists = prev.some(c => c.id === recovered.id);
          return exists ? prev : [recovered, ...prev];
        });
        setSelectedCourseId(recovered.id);
        setView("viewer");
        trackEvent({ name: "course_created_recovery", properties: { title: generatingTitle } });
        courseRecovered = true;
        return;
      }

      // ═══ NO RECOVERY — Show specific error message ═══
      const errorMsg = getErrorMessage(lastErrorType, lastHttpStatus, lastError || "");
      console.error(`[generate] ALL ATTEMPTS FAILED: type=${lastErrorType}, status=${lastHttpStatus}, detail=${lastError}`);
      setError(errorMsg);
    } finally {
      clearTimeout(timeoutId);
      generatingRef.current = false;
      setLoading(false);
      setIsGenerating(false);
      abortRef.current = null;
      // Only refresh courses list if we're still on this page (not redirected to viewer)
      if (!courseRecovered) {
        fetchCourses();
      }
    }
  };

  //  Open a course 
  const openCourse = (id: string) => {
    setSelectedCourseId(id);
    setView("viewer");
  };

  //  Helpers 
  const courseLangLabels = tx.create.courseLangs;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <>
    <div className="w-full max-w-2xl mx-auto px-4 pt-14 sm:pt-20 pb-8 md:pt-24 md:pb-16">
      {/* ═══════════ Personalized Greeting ═══════════ */}
      {user && (
        <div className="mb-6 sm:mb-8">
          <div className="glass rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 text-center">
            <div className="text-4xl sm:text-5xl mb-3 animate-bounce" role="img" aria-label="waving hand">👋</div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold mb-2">
              <span className="gradient-text">{greeting.greeting} {greeting.name} !</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
              {greeting.message}
            </p>
          </div>
        </div>
      )}

      {/* ═══════════ Main creation card ═══════════ */}
      <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-10">
        {/*  Title input  */}
        <div className="mb-8">
          <label className="block text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">
            {tx.create.placeholder}
          </label>
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder=""
              className="w-full px-4 py-3.5 sm:px-6 sm:py-5 rounded-2xl bg-night border border-border text-foreground text-base sm:text-lg font-bold placeholder:text-muted-foreground/50 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300 min-h-[44px]"
              onKeyDown={(e) => e.key === "Enter" && generateCourse()}
              disabled={loading}
            />
            {/* Animated placeholder overlay */}
            {!title && (
              <div
                className={`absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-lg font-bold transition-opacity duration-500 ease-in-out ${
                  placeholderPhase === "fadingOut" || placeholderPhase === "fadingIn"
                    ? "opacity-0"
                    : "opacity-100"
                }`}
                aria-hidden="true"
              >
                <span className="text-muted-foreground/40">
                  {displayedPlaceholder}
                </span>
                {placeholderPhase === "typing" && (
                  <span className="inline-block w-0.5 h-5 bg-mauve/60 ml-0.5 align-middle animate-pulse" />
                )}
              </div>
            )}
          </div>
        </div>

        {/*  Source links  */}
        <div className="mb-8">
          <label className="block text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">
            <LinkIcon className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {tx.create.links}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder={tx.create.linkPlaceholder}
              className="flex-1 px-5 py-3.5 rounded-2xl bg-night border border-border text-foreground font-semibold placeholder:text-muted-foreground/50 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
              disabled={loading}
            />
            <button
              onClick={addLink}
              disabled={!linkInput.trim() || loading}
              className="px-5 py-3.5 rounded-2xl bg-mauve/20 text-mauve-light font-bold hover:bg-mauve/30 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {links.length > 0 && (
            <div className="mt-3 space-y-2">
              {links.map((link, i) => (
                <div
                  key={link}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-night/50 border border-border text-sm transition-all duration-200"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-mauve-light flex-shrink-0" />
                  <span className="truncate flex-1 text-muted-foreground">
                    {link}
                  </span>
                  <button
                    onClick={() => removeLink(i)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/*  Course language selector  */}
        <div className="mb-8">
          <label className="block text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">
            <Globe className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {tx.create.courseLang}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["fr", "en"] as const).map((lng, i) => {
              const isSelected = courseLang === lng;
              return (
                <button
                  key={lng}
                  onClick={() => setCourseLang(lng)}
                  className={`relative px-4 py-4 rounded-2xl font-bold text-center cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? "bg-mauve/20 border-2 border-mauve text-mauve-light shadow-lg shadow-mauve/10"
                      : "glass border-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">
                      {lng === "fr" ? "🇫🇷" : "🇬🇧"}
                    </span>
                    <span className="text-sm md:text-base">{courseLangLabels[i]}</span>
                  </div>
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-mauve border-2 border-night" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/*  Level selector  */}
        {!isRandomTopic && (
          <div className="mb-8">
            <label className="block text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">
              {tx.create.level}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {tx.create.levels.map((levelName, i) => {
                const isSelected = selectedLevel === i;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedLevel(i)}
                    className={`relative px-4 py-4 rounded-2xl font-bold text-center cursor-pointer transition-all duration-300 ${
                      isSelected
                        ? "bg-mauve/20 border-2 border-mauve text-mauve-light shadow-lg shadow-mauve/10"
                        : "glass border-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="text-sm md:text-base">{levelName}</span>
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-mauve border-2 border-night" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {isRandomTopic && (
          <div className="mb-8 flex items-center gap-2 animate-fade-in-slide-up">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{tx.create.level}</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mauve/15 border border-mauve/25 text-xs font-bold text-mauve-light">
              {tx.create.levels[0]}
            </span>
          </div>
        )}

        {/*  Grace period: subscription ended  */}
        {inGracePeriod ? (
          <div className="mb-6 p-5 rounded-2xl glass text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-3">
              <Crown className="w-7 h-7 text-gold" />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">
              {lang === "fr" ? "Abonnement terminé" : "Subscription ended"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "fr"
                ? "Renouvelle ton abonnement pour continuer à créer des cours."
                : "Renew your subscription to keep creating courses."}
            </p>
            <button
              onClick={() => setView("offers")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night text-sm font-extrabold hover:from-amber-400 hover:to-gold transition-all duration-300 cursor-pointer"
            >
              <Crown className="w-4 h-4" />
              {lang === "fr" ? "Voir les abonnements" : "See plans"}
            </button>
          </div>
        ) : null}

        {paywallLoaded && !hasSubscription && !inGracePeriod && localFreeCourseUsed && (
          <div className="mb-6 p-5 rounded-2xl glass text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-mauve/10 flex items-center justify-center mx-auto mb-3">
              <GraduationCap className="w-7 h-7 text-mauve-light" />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">
              {lang === "fr"
                ? "Tu as utilisé ton cours gratuit"
                : "You've used your free course"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "fr"
                ? "Passe à un abonnement pour continuer à créer des cours personnalisés."
                : "Upgrade to a subscription to keep creating personalized courses."}
            </p>
            <button
              onClick={() => setView("offers")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-sm font-extrabold hover:from-mauve-light hover:to-mauve transition-all duration-300 cursor-pointer"
            >
              <Crown className="w-4 h-4" />
              {lang === "fr" ? "Voir les offres" : "See plans"}
            </button>
          </div>
        )}

        {/*  First course free badge (only when freeCourseUsed is false)  */}
        {paywallLoaded && !hasSubscription && !inGracePeriod && !localFreeCourseUsed && (
          <div className="mb-6 p-4 rounded-2xl glass text-center animate-fade-in">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-gold" />
              <span className="text-sm font-bold text-gold">
                {lang === "fr" ? "Ton premier cours est gratuit !" : "Your first course is free!"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "fr"
                ? "Découvre la puissance de l'IA pour créer ton premier cours. Ensuite, choisis un abonnement."
                : "Discover the power of AI to create your first course. Then choose a subscription."}
            </p>
          </div>
        )}

        {/*  Daily limit reached (subscribers only)  */}
        {dailyLimitReached && countdown && (
          <div className="mb-6 p-5 rounded-2xl glass text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-mauve/10 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-7 h-7 text-mauve-light" />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">
              {lang === "fr"
                ? "Limite de génération atteinte pour aujourd'hui"
                : "Daily generation limit reached"}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {lang === "fr"
                ? `Tu as créé tes ${dailyCoursesToday}/${dailyLimitTotal} cours aujourd'hui. Reviens bientôt !`
                : `You've created ${dailyCoursesToday}/${dailyLimitTotal} courses today. Come back soon!`}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mauve/10 text-mauve-light text-lg font-extrabold tabular-nums">
              <Clock className="w-4 h-4" />
              {countdown}
            </div>
          </div>
        )}

        {/*  Error  */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold animate-[fadeIn_0.3s_ease-out]">
            {error}
          </div>
        )}

        {/*  Suggested topic banner  */}
        {showSuggested && suggestedTopic && (
          <div className="mb-6 p-4 rounded-2xl glass text-center animate-fade-in-slide-up">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
              ✨ {tx.create.suggested}
            </p>
            <p className="text-lg font-extrabold gradient-text">{suggestedTopic}</p>
          </div>
        )}

        {/*  Generate button  */}
        <div className="flex items-center justify-center sm:justify-center">
          <button
            onClick={generateCourse}
            disabled={!title.trim() || loading || !paywallLoaded || dailyLimitReached}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-base sm:text-lg font-extrabold hover:from-mauve-light hover:to-mauve transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-mauve/25 hover:shadow-mauve/40 hover:scale-[1.02] active:scale-[0.98] min-h-[44px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="flex items-center gap-2">
                  <span>{progressMessages[generationStep]}</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>{tx.create.generate}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════ Recent courses ═══════════ */}
      <div className="mt-10 md:mt-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-mauve-light" />
            {tx.create.myCourses}
          </h2>
        </div>

        {courses.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center">
            <div className="text-4xl mb-3 opacity-40">📚</div>
            <p className="text-muted-foreground font-semibold text-lg">
              {tx.create.noCourses}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.slice(0, 6).map((course) => (
              <button
                key={course.id}
                onClick={() => openCourse(course.id)}
                className="group glass rounded-3xl p-5 text-left cursor-pointer transition-all duration-300 hover:bg-white/5 hover:shadow-lg hover:shadow-mauve/10 hover:scale-[1.02] active:scale-[0.98]"
              >
                {/* Course icon area */}
                <div className="w-12 h-12 rounded-2xl bg-mauve/15 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-mauve/25">
                  <BookOpen className="w-5 h-5 text-mauve-light" />
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-foreground mb-2 line-clamp-2 leading-snug transition-colors duration-200 group-hover:text-mauve-light">
                  {course.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                  {course.description}
                </p>

                {/* Meta info */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground/70 font-medium">
                    {formatDate(course.createdAt)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Progress pill */}
                    {course.overallProgress > 0 && (
                      <span className="text-xs font-bold text-mauve-light bg-mauve/15 px-2.5 py-1 rounded-full">
                        {course.overallProgress}%
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-mauve-light" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
