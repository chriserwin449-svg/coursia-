"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";
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
  const backgroundGeneration = useAppStore((s) => s.backgroundGeneration);
  const setBackgroundGeneration = useAppStore((s) => s.setBackgroundGeneration);

  const [title, setTitle] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [courseLang, setCourseLang] = useState("fr"); // "fr" or "en"
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const courses = useAppStore((s) => s.courses);
  const [showSuggested, setShowSuggested] = useState(false);
  const [suggestedTopic, setSuggestedTopic] = useState("");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [canCreateCourse, setCanCreateCourse] = useState(false);
  const [paywallLoaded, setPaywallLoaded] = useState(false);
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [localFreeCourseUsed, setLocalFreeCourseUsed] = useState(() => useAppStore.getState().freeCourseUsed);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [dailyResetInMs, setDailyResetInMs] = useState(0);
  const [dailyCoursesToday, setDailyCoursesToday] = useState(0);
  const [dailyLimitTotal, setDailyLimitTotal] = useState(4);
  const [selectedLevel, setSelectedLevel] = useState(0);
  const [isRandomTopic, setIsRandomTopic] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [isBackgroundMode, setIsBackgroundMode] = useState(false);

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
  const limitTimestampRef = useRef<number>(0);
  useEffect(() => {
    if (!dailyLimitReached || dailyResetInMs <= 0) {
      setCountdown("");
      return;
    }
    if (!limitTimestampRef.current) {
      limitTimestampRef.current = Date.now();
    }
    const update = () => {
      const remaining = Math.max(0, dailyResetInMs - (Date.now() - limitTimestampRef.current));
      if (remaining <= 0) {
        setCountdown("");
        setDailyLimitReached(false);
        limitTimestampRef.current = 0;
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
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dailyLimitReached, dailyResetInMs]);

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

  //  Fetch courses & subscription status (declared early — used in useEffect dependency arrays)
  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses?userId=${useAppStore.getState().userId || ''}`);
      if (res.ok) {
        const data = await res.json();
        const list = (data.courses as CourseData[]) || [];
        useAppStore.getState().setCourses(list);
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
        const canGenerate = pw.canGenerate === true || pw.canGenerate === undefined;
        setCanCreateCourse(canGenerate);
        const apiFreeUsed = !!pw.freeCourseUsed;
        // Admin users: always trust API (freeCourseUsed=false), clear stale store value
        const isStoreStale = pw.paywallReason === "admin" && useAppStore.getState().freeCourseUsed;
        const effectiveFreeUsed = isStoreStale ? false : (apiFreeUsed || useAppStore.getState().freeCourseUsed);
        setLocalFreeCourseUsed(effectiveFreeUsed);
        useAppStore.getState().setFreeCourseUsed(effectiveFreeUsed);
        useAppStore.getState().setExpiryWarning48h(!!pw.expiryWarning48h);
        setDailyLimitReached(!!pw.dailyLimitReached);
        setDailyResetInMs(pw.dailyResetInMs || 0);
        setDailyCoursesToday(pw.coursesToday || 0);
        setDailyLimitTotal(pw.dailyLimit || 4);
      } else {
        console.warn("[fetchCourses] Paywall status returned", pwRes.status, "— defaulting canCreateCourse to true");
        setCanCreateCourse(true);
      }
    } catch (err) {
      console.warn("[fetchCourses] Paywall status fetch failed — defaulting canCreateCourse to true", err);
      setCanCreateCourse(true);
    } finally {
      setPaywallLoaded(true);
    }
  }, []);

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

  // ── Resume loading state if there's a pending background generation ──
  useEffect(() => {
    if (backgroundGeneration && !loading) {
      // User returned to create page while generation is running in background
      setLoading(true);
      setIsGenerating(true);
      setIsBackgroundMode(true);
      setGenerationStep(2); // Jump to "Creating outline..." step
      progressStartRef.current = backgroundGeneration.startedAt;
      console.log("[create] Resumed background generation tracking for:", backgroundGeneration.title);
    }
  }, []); // run once on mount to resume background generation

  // ── Cleanup local state when background generation completes (cleared by poller) ──
  useEffect(() => {
    if (!backgroundGeneration) {
      // BackgroundGenerationPoller found the course and cleared the store
      console.log("[create] Background generation completed or cleared, cleaning up local state");
      generatingRef.current = false;
      setLoading(false);
      setIsGenerating(false);
      fetchCourses();
    }
  }, [backgroundGeneration, fetchCourses]);

  // Simulate step progression based on time elapsed
  useEffect(() => {
    if (!loading) { setGenerationStep(0); return; }
    // Advance through steps: each step ~12-15s (course takes ~60-90s total)
    const stepDurations = [2000, 8000, 20000, 40000, 50000]; // ms thresholds (matches ~55s total)
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

  //  Generate course — FIRE-AND-FORGET with immediate background mode
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

    // ═══ FREE COURSE PRE-CHECK: block second course generation immediately ═══
    if (localFreeCourseUsed && !hasSubscription && !inGracePeriod) {
      console.log("[generate] Blocked: free course already used, redirecting to offers");
      useAppStore.getState().setPendingGeneration({
        topic: title.trim(),
        courseLang,
        level: effectiveLevel,
        isRandom: !!isRandomTopic,
      });
      setView("offers");
      return;
    }

    const generatingTitle = title.trim();
    const payload = {
      title: generatingTitle,
      sourceLinks: links,
      level: effectiveLevel,
      courseLang,
      userId: useAppStore.getState().userId,
    };

    console.log("[generate] Starting fire-and-forget generation:", { title: generatingTitle, level: effectiveLevel, lang: courseLang });

    // ═══ IMMEDIATE BACKGROUND MODE — user can navigate freely ═══
    generatingRef.current = true;
    setLoading(true);
    setError("");
    setIsGenerating(true);
    setGenerationStep(0);
    progressStartRef.current = Date.now();

    // Set background generation in the store (survives page navigation)
    setBackgroundGeneration({
      title: generatingTitle,
      startedAt: Date.now(),
      userId: useAppStore.getState().userId || "",
    });

    // Show toast that generation started
    toast.info(
      lang === "fr"
        ? "✨ Génération du cours en cours..."
        : "✨ Generating your course...",
      {
        description:
          lang === "fr"
            ? "Tu recevras une notification quand le cours sera prêt. Tu peux continuer à naviguer."
            : "You'll get a notification when it's ready. Feel free to navigate.",
        duration: 5000,
      }
    );

    // ═══ FIRE-AND-FORGET: don't await the response ═══
    fetch("/api/courses/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (res.ok) {
        try {
          const data = await res.json();
          if (data.course) {
            // Generation completed while we were watching — handle immediately
            console.log("[generate] Fire-and-forget completed:", data.course.title);
            const course = data.course as CourseData;
            // Clear background mode
            generatingRef.current = false;
            setLoading(false);
            setIsGenerating(false);
            setBackgroundGeneration(null);
            setCanCreateCourse(false);
            setLocalFreeCourseUsed(true);
            useAppStore.getState().setFreeCourseUsed(true);
            // Refresh courses list
            const coursesRes = await fetch(`/api/courses?userId=${useAppStore.getState().userId || ''}`);
            if (coursesRes.ok) {
              const coursesData = await coursesRes.json();
              useAppStore.getState().setCourses(coursesData.courses || []);
            }
            // Show success notification
            toast.success(
              lang === "fr" ? `🎉 Cours "${course.title}" prêt !` : `🎉 Course "${course.title}" ready!`,
              {
                description: lang === "fr" ? "Clique pour commencer l'apprentissage." : "Click to start learning.",
                action: {
                  label: lang === "fr" ? "Voir le cours" : "View course",
                  onClick: () => {
                    setSelectedCourseId(course.id);
                    setView("viewer");
                  },
                },
                duration: 8000,
              }
            );
            trackEvent({ name: "course_created", properties: { plan: String(effectiveLevel), mode: "fire-and-forget" } });
            // If user is on create page, auto-redirect
            if (useAppStore.getState().view === "create") {
              setSelectedCourseId(course.id);
              setView("viewer");
            }
            return;
          }
        } catch {
          // Failed to parse success response — poller will handle it
        }
      }
      // Non-200 or parse failure — poller handles recovery
      console.log("[generate] Fire-and-forgot request returned non-success, poller will handle recovery");
    }).catch((err) => {
      // Network error — poller handles recovery
      console.warn("[generate] Fire-and-forget network error:", err);
    });

    // User can now navigate freely — BackgroundGenerationPoller handles the rest
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
    <div className="w-full max-w-2xl mx-auto px-4 pt-14 sm:pt-20 pb-8 md:pt-24 md:pb-16 overflow-x-hidden">
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
              className="flex-1 min-w-0 px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl bg-night border border-border text-foreground font-semibold placeholder:text-muted-foreground/50 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300"
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
              className="px-3 sm:px-5 py-3 sm:py-3.5 rounded-2xl bg-mauve/20 text-mauve-light font-bold hover:bg-mauve/30 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
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
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {tx.create.levels.map((levelName, i) => {
                const isSelected = selectedLevel === i;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedLevel(i)}
                    className={`relative min-w-0 px-3 py-3 sm:px-4 sm:py-4 rounded-2xl font-bold text-center cursor-pointer transition-all duration-300 ${
                      isSelected
                        ? "bg-mauve/20 border-2 border-mauve text-mauve-light shadow-lg shadow-mauve/10"
                        : "glass border-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="text-xs sm:text-sm md:text-base break-words whitespace-normal leading-snug">{levelName}</span>
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
            <p className="text-base font-bold text-foreground mb-1">
              {lang === "fr"
                ? "Vous avez utilisé votre cours gratuit"
                : "You've used your free course"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
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
                ? `Tu as créé tes ${dailyCoursesToday} cours aujourd'hui. Reviens bientôt !`
                : `You've created ${dailyCoursesToday} courses today. Come back soon!`}
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

        {/*  Background generation notice — removed (button already shows generation status)  */}

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
