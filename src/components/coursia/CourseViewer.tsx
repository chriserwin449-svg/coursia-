"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Check,
  X,
  Lock,
  Loader2,
  BookOpen,
  Trophy,
  FileText,
  AlertTriangle,
  Rocket,
  Crown,
  Share2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import ShareCourseDialog from "@/components/coursia/ShareCourseDialog";
import { useAppStore, type CourseData, type CourseChapter, type QuizQuestion } from "@/lib/store";
import { t } from "@/lib/i18n";
import Confetti from "@/components/coursia/Confetti";
import CoursiaLogo from "@/components/coursia/CoursiaLogo";

const LEVEL_EMOJIS = ["🌱", "⚡", "🔥"];
const LEVEL_NAMES_FR = ["Débutant", "Intermédiaire", "Avancé"];
const LEVEL_NAMES_EN = ["Beginner", "Intermediate", "Advanced"];

export default function CourseViewer() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const user = useAppStore((s) => s.user);

  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);
  const [studySessionId, setStudySessionId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const isCompletingRef = useRef(false);
  const [mobileChapterOpen, setMobileChapterOpen] = useState(false);

  // Paywall state for grace period / locked access
  const [canStudy, setCanStudy] = useState(true);
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [graceDaysRemaining, setGraceDaysRemaining] = useState(0);
  const [graceExpired, setGraceExpired] = useState(false);
  const [isFreeUser, setIsFreeUser] = useState(false);

  // Level system states
  const [isGeneratingLevel, setIsGeneratingLevel] = useState(false);
  const [showReviewScreen, setShowReviewScreen] = useState(false);
  const [completedLevel, setCompletedLevel] = useState(-1);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showAllMastered, setShowAllMastered] = useState(false);
  // Level quiz states
  const [showLevelQuiz, setShowLevelQuiz] = useState(false);
  const [levelQuizLevel, setLevelQuizLevel] = useState(0);
  const [levelQuizSecondAttempt, setLevelQuizSecondAttempt] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const selectedCourseId = useAppStore((s) => s.selectedCourseId);
  const currentChapterIndex = useAppStore((s) => s.currentChapterIndex);
  const setCurrentChapterIndex = useAppStore((s) => s.setCurrentChapterIndex);
  const isFullscreen = useAppStore((s) => s.isFullscreen);
  const setIsFullscreen = useAppStore((s) => s.setIsFullscreen);
  const showFinalQuiz = useAppStore((s) => s.showFinalQuiz);
  const setShowFinalQuiz = useAppStore((s) => s.setShowFinalQuiz);
  const setView = useAppStore((s) => s.setView);
  const showCelebration = useAppStore((s) => s.showCelebration);
  const setShowCelebration = useAppStore((s) => s.setShowCelebration);
  const setCelebrationMessage = useAppStore((s) => s.setCelebrationMessage);
  const setRandomTopic = useAppStore((s) => s.setRandomTopic);
  const setRandomCourseLang = useAppStore((s) => s.setRandomCourseLang);

  const chapterListRef = useRef<HTMLDivElement>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const finalQuizTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Expanded chapters state for sub-chapter display ──
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());

  const toggleChapterExpanded = (idx: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  // ── Parse sub-chapters from markdown content ──
  const parseSubChapters = useCallback((content: string): string[] => {
    return content.match(/^## (.+)$/gm)?.map((s) => s.replace(/^## /, "")) || [];
  }, []);

  const chapterSubChapters = useMemo(() => {
    if (!course) return {} as Record<string, string[]>;
    const map: Record<string, string[]> = {};
    for (const ch of course.chapters) map[ch.id] = parseSubChapters(ch.content || "");
    return map;
  }, [course, parseSubChapters]);

  // ── Group chapters by level ──
  const chaptersByLevel = useMemo(() => {
    if (!course) return [];
    const levels: { level: number; chapters: { chapter: CourseChapter; globalIdx: number }[] }[] = [];
    let currentLevel = -1;
    for (let i = 0; i < course.chapters.length; i++) {
      const ch = course.chapters[i];
      const chLevel = ch.level ?? 0;
      if (chLevel !== currentLevel) {
        levels.push({ level: chLevel, chapters: [] });
        currentLevel = chLevel;
      }
      levels[levels.length - 1].chapters.push({ chapter: ch, globalIdx: i });
    }
    return levels;
  }, [course]);

  // ── Get current max level and stopped state ──
  const maxUnlockedLevel = course?.maxUnlockedLevel ?? 0;
  const stoppedAtLevel = course?.stoppedAtLevel ?? -1;
  const isStopped = stoppedAtLevel >= 0;

  // ── Completed count and progress ──
  const completedCount = useMemo(() => {
    if (!course) return 0;
    return course.chapters.filter((ch) => ch.progress?.completed).length;
  }, [course]);

  const totalChapters = course?.chapters.length ?? 0;
  const overallProgress = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;

  // Check if all chapters in current max level are completed
  const allCurrentLevelCompleted = useMemo(() => {
    if (!course) return false;
    const levelChapters = course.chapters.filter((ch) => (ch.level ?? 0) <= maxUnlockedLevel);
    if (levelChapters.length === 0) return false;
    return levelChapters.every((ch) => ch.progress?.completed);
  }, [course, maxUnlockedLevel]);

  const allChaptersCompleted = totalChapters > 0 && completedCount === totalChapters;

  // ── Check if a chapter is level-locked ──
  const isChapterLevelLocked = (index: number): boolean => {
    if (!course) return false;
    const ch = course.chapters[index];
    if (!ch) return true;
    const chLevel = ch.level ?? 0;
    // Locked if chapter level exceeds maxUnlockedLevel
    if (chLevel > maxUnlockedLevel) return true;
    // If stopped, lock chapters above stoppedAtLevel
    if (isStopped && chLevel > stoppedAtLevel) return true;
    return false;
  };

  const isChapterUnlocked = (index: number) => {
    if (isChapterLevelLocked(index)) return false;
    if (!course) return false;
    if (index < 0 || index >= course.chapters.length) return false;
    if (index === 0) return true;
    return course.chapters[index - 1]?.progress?.completed === true;
  };

  // ── Study session tracking ──
  const startStudySession = useCallback(async (cId: string, chId?: string) => {
    try {
      const userId = useAppStore.getState().userId;
      const res = await fetch("/api/study-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", courseId: cId, chapterId: chId, userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setStudySessionId(data.sessionId);
      }
    } catch { /* ignore */ }
  }, []);

  const endStudySession = useCallback(async () => {
    if (!studySessionId) return;
    try {
      const userId = useAppStore.getState().userId;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userId) headers["Authorization"] = `Bearer ${userId}`;
      await fetch("/api/study-time", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "end", sessionId: studySessionId, userId }),
      });
    } catch { /* ignore */ }
    setStudySessionId(null);
  }, [studySessionId]);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      if (finalQuizTimerRef.current) clearTimeout(finalQuizTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (studySessionId) {
        fetch("/api/study-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", sessionId: studySessionId, userId: useAppStore.getState().userId }),
        }).catch(() => {});
      }
    };
  }, [studySessionId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (studySessionId) {
        navigator.sendBeacon("/api/study-time", new Blob([JSON.stringify({ action: "end", sessionId: studySessionId, userId: useAppStore.getState().userId })], { type: "application/json" }));
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [studySessionId]);

  const fetchCourse = useCallback(async () => {
    if (!selectedCourseId) return;
    setLoading(true);
    setFetchError(false);
    setHasAttemptedFetch(false);

    // Retry logic: the course may have just been created and DB not fully committed
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Fetch subscription status in parallel with course data
        const userId = useAppStore.getState().userId;
        const authHeaders: Record<string, string> = {};
        if (userId) authHeaders["Authorization"] = `Bearer ${userId}`;

        const [courseRes, statusRes] = await Promise.all([
          fetch(`/api/courses/${selectedCourseId}`),
          userId ? fetch("/api/courses/paywall-status", { headers: authHeaders }) : Promise.resolve(null),
        ]);

        const data = await courseRes.json();
        // Parse subscription status
        if (statusRes && statusRes.ok) {
          const pw = await statusRes.json();
          setCanStudy(pw.canStudy !== false);
          setInGracePeriod(!!pw.inGracePeriod);
          setGraceDaysRemaining(pw.graceDaysRemaining || 0);
          setGraceExpired(pw.showPaywall && pw.paywallReason === "grace_expired");
          setIsFreeUser(!pw.hasSubscription);
        }

        if (courseRes.ok && data.chapters?.length > 0) {
          setCourse(data);
          if (data.courseCompleted) setCourseCompleted(true);
          const savedChapterKey = `coursia-last-chapter-${selectedCourseId}`;
          const savedChapter = typeof window !== "undefined" ? localStorage.getItem(savedChapterKey) : null;
          let restoreIdx = 0;
          if (savedChapter) {
            const savedIdx = parseInt(savedChapter, 10);
            if (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < data.chapters.length) {
              if (!isChapterLevelLockedForData(savedIdx, data)) restoreIdx = savedIdx;
            }
          }
          if (restoreIdx === 0) {
            const firstIncomplete = data.chapters.findIndex((ch: CourseChapter) => !ch.progress?.completed && !isChapterLevelLockedForData(data.chapters.indexOf(ch), data));
            if (firstIncomplete >= 0) restoreIdx = firstIncomplete;
          }
          const currentIdx = useAppStore.getState().currentChapterIndex;
          if (currentIdx === 0 || currentIdx >= data.chapters.length) {
            setCurrentChapterIndex(restoreIdx);
          }
          startStudySession(selectedCourseId, data.chapters[restoreIdx >= 0 ? restoreIdx : 0]?.id);
          setHasAttemptedFetch(true);

          // ── Restore quiz state after returning from payment ──
          // Check if there are saved quiz answers in localStorage (user was blocked mid-quiz)
          if (typeof window !== "undefined") {
            for (let i = 0; i < window.localStorage.length; i++) {
              const key = window.localStorage.key(i);
              if (key && key.startsWith(`coursia-quiz-answers-${selectedCourseId}-level-`)) {
                const levelStr = key.replace(`coursia-quiz-answers-${selectedCourseId}-level-`, "");
                const savedLevel = parseInt(levelStr, 10);
                if (!isNaN(savedLevel)) {
                  setLevelQuizLevel(savedLevel);
                  setShowLevelQuiz(true);
                }
                break;
              }
            }
          }

          setLoading(false);
          return; // success
        } else if (attempt < maxRetries - 1) {
          // Course not found yet (may have just been created), wait and retry
          console.log(`[viewer] Course not ready (attempt ${attempt + 1}/${maxRetries}), retrying in 2s...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        } else {
          setFetchError(true);
        }
      } catch (err) {
        if (attempt < maxRetries - 1) {
          console.log(`[viewer] Fetch error (attempt ${attempt + 1}/${maxRetries}), retrying in 2s...`, err);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        setFetchError(true);
      }
    }
    setHasAttemptedFetch(true);
    setLoading(false);
  }, [selectedCourseId, setCurrentChapterIndex]);

  // Helper to check level lock for data during fetch (before state is set)
  const isChapterLevelLockedForData = (index: number, data: CourseData): boolean => {
    const ch = data.chapters[index];
    const chLevel = ch.level ?? 0;
    if (chLevel > (data.maxUnlockedLevel ?? 0)) return true;
    if ((data.stoppedAtLevel ?? -1) >= 0 && chLevel > (data.stoppedAtLevel ?? -1)) return true;
    return false;
  };

  useEffect(() => { fetchCourse(); }, [selectedCourseId, fetchCourse]);

  useEffect(() => {
    if (!chapterListRef.current) return;
    const activeEl = chapterListRef.current.querySelector(`[data-chapter-idx="${currentChapterIndex}"]`);
    if (activeEl) activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentChapterIndex]);

  useEffect(() => {
    if (!course) return;
    const activeCh = course.chapters[currentChapterIndex];
    if (!activeCh) return;
    const subs = chapterSubChapters[activeCh.id];
    if (subs && subs.length > 0) {
      setExpandedChapters((prev) => {
        if (prev.has(currentChapterIndex)) return prev;
        const next = new Set(prev);
        next.add(currentChapterIndex);
        return next;
      });
    }
  }, [currentChapterIndex, course, chapterSubChapters]);

  useEffect(() => {
    if (!selectedCourseId || !course) return;
    localStorage.setItem(`coursia-last-chapter-${selectedCourseId}`, String(currentChapterIndex));
  }, [currentChapterIndex, selectedCourseId, course]);

  const currentChapter = course?.chapters?.[currentChapterIndex] ?? null;

  const completeCurrentChapter = useCallback(async (): Promise<boolean> => {
    if (!currentChapter || currentChapter.progress?.completed) return true;
    try {
      const userId = useAppStore.getState().userId;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userId) headers["Authorization"] = `Bearer ${userId}`;
      const res = await fetch(`/api/courses/${selectedCourseId}/chapters/${currentChapter.id}/complete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const courseRes = await fetch(`/api/courses/${selectedCourseId}`);
        if (courseRes.ok) setCourse(await courseRes.json());
        return true;
      }
      return false;
    } catch { return false; }
  }, [currentChapter, selectedCourseId]);

  // ── Level names helper (defined early — referenced in useCallback deps) ──
  const getLevelName = (level: number) => lang === "fr" ? LEVEL_NAMES_FR[level] : LEVEL_NAMES_EN[level];

  const goToNext = useCallback(async () => {
    if (!course || isCompletingRef.current) return;
    if (currentChapterIndex >= course.chapters.length - 1) return;

    isCompletingRef.current = true;
    const wasJustCompleted = !currentChapter?.progress?.completed;
    const nextIdx = currentChapterIndex + 1;
    const chapterNum = currentChapterIndex + 1;

    // Show chapter completion celebration IMMEDIATELY (before any async work)
    if (wasJustCompleted) {
      const userName = user?.firstName || (lang === "fr" ? "Champion" : "Champion");
      setShowConfetti(true);
      setShowCelebration(true);
      setCelebrationMessage(lang === "fr" ? `Chapitre ${chapterNum} terminé ${userName} ! 🎉` : `Chapter ${chapterNum} done ${userName}! 🎉`);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = setTimeout(() => { setShowCelebration(false); setShowConfetti(false); }, 2000);
    }

    // Navigate IMMEDIATELY
    setCurrentChapterIndex(nextIdx);
    endStudySession();
    startStudySession(course.id, course.chapters[nextIdx]?.id);

    // Complete the previous chapter entirely in the background (don't block UI, no celebration here)
    if (wasJustCompleted) {
      completeCurrentChapter().catch(() => { /* non-critical */ });
    }

    isCompletingRef.current = false;
  }, [course, currentChapter?.progress?.completed, currentChapterIndex, completeCurrentChapter, user?.firstName, lang, endStudySession, startStudySession, setCurrentChapterIndex]);

  // ── Complete last chapter of a level → show level quiz → celebration + level-up prompt ──
  const handleCompleteLevel = useCallback(async () => {
    if (!course || isCompletingRef.current) return;
    if (isStopped) return; // Already stopped — cannot re-take quiz
    isCompletingRef.current = true;
    setIsCompleting(true);

    // Mark current chapter complete
    const wasJustCompleted = !currentChapter?.progress?.completed;
    if (wasJustCompleted) {
      await completeCurrentChapter();
    }
    endStudySession();

    // Determine the completed level
    const currentChLevel = currentChapter?.level ?? 0;
    const currentMaxLevel = course?.maxUnlockedLevel ?? 0;
    const completedLvl = Math.max(currentChLevel, currentMaxLevel);

    // Award level completion bonus via API
    try {
      const userId = useAppStore.getState().userId;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userId) headers["Authorization"] = `Bearer ${userId}`;
      await fetch(`/api/courses/${selectedCourseId}/complete-level`, {
        method: "POST",
        headers,
        body: JSON.stringify({ level: completedLvl, userId }),
      });
    } catch { /* non-critical */ }

    // Refetch course to get updated progress
    const courseRes = await fetch(`/api/courses/${selectedCourseId}`);
    if (courseRes.ok) setCourse(await courseRes.json());

    // Show LEVEL completion celebration with level name
    const userName = user?.firstName || (lang === "fr" ? "Champion" : "Champion");
    const levelName = getLevelName(completedLvl);
    setShowConfetti(true);
    setShowCelebration(true);
    setCelebrationMessage(lang === "fr"
      ? `Niveau ${levelName} terminé ${userName} ! 🎉`
      : `${levelName} level done ${userName}! 🎉`);

    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = setTimeout(() => {
      setShowCelebration(false);
      setShowConfetti(false);

      // Now show the LEVEL QUIZ before proceeding to next level
      setCompletedLevel(completedLvl);
      setLevelQuizLevel(completedLvl);
      setLevelQuizSecondAttempt(false);
      setShowLevelQuiz(true);
    }, 2500);

    isCompletingRef.current = false;
    setIsCompleting(false);
  }, [course, currentChapter, currentChapterIndex, completeCurrentChapter, user?.firstName, lang, endStudySession, selectedCourseId, isStopped, getLevelName]);

  const goToPrev = useCallback(() => {
    if (currentChapterIndex === 0 || !course) return;
    endStudySession();
    const prevIdx = currentChapterIndex - 1;
    setCurrentChapterIndex(prevIdx);
    startStudySession(course.id, course.chapters[prevIdx]?.id);
  }, [currentChapterIndex, course, endStudySession, startStudySession, setCurrentChapterIndex]);

  // ── Level Complete handler ──
  const handleFinalQuizComplete = useCallback(async (passed: boolean) => {
    if (!passed) return;
    const userName = user?.firstName || (lang === "fr" ? "Champion" : "Champion");
    setShowConfetti(true);
    setShowCelebration(true);
    setCelebrationMessage(lang === "fr" ? `Félicitations ${userName} ! 🏆` : `Congratulations ${userName}! 🏆`);
    setCourseCompleted(true);

    // Generate certificate when course is completed
    try {
      const userId = useAppStore.getState().userId;
      await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${userId}` },
        body: JSON.stringify({ courseId: selectedCourseId }),
      });
    } catch { /* non-blocking */ }

    if (finalQuizTimerRef.current) clearTimeout(finalQuizTimerRef.current);
    finalQuizTimerRef.current = setTimeout(() => {
      setShowCelebration(false);
      setShowFinalQuiz(false);
      setShowConfetti(false);
      endStudySession();

      const courseLevel = course?.level ?? 0;
      const currentMaxLevel = course?.maxUnlockedLevel ?? 0;
      setCompletedLevel(currentMaxLevel);

      if (courseLevel >= 2 && currentMaxLevel >= 2) {
        // All levels mastered!
        setShowAllMastered(true);
      } else {
        // Show level-up modal
        setShowReviewScreen(true);
      }
      fetchCourse();
    }, 4000);
  }, [course, user?.firstName, lang, endStudySession, fetchCourse]);

  // ── Level Quiz Complete handler ──
  const handleLevelQuizComplete = useCallback((passed: boolean, pointsEarned: number, canRetry: boolean) => {
    if (passed) {
      const userName = user?.firstName || (lang === "fr" ? "Champion" : "Champion");
      setShowConfetti(true);
      setShowCelebration(true);
      const levelEmojis = ["🌱", "⚡", "🔥"];
      const lvl = completedLevel;
      setCelebrationMessage(lang === "fr"
        ? `Quiz réussi ${userName} ! ${levelEmojis[Math.min(lvl, 2)]} +${pointsEarned}pts 🔥`
        : `Quiz passed ${userName}! ${levelEmojis[Math.min(lvl, 2)]} +${pointsEarned}pts 🔥`);
      setShowLevelQuiz(false);

      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = setTimeout(() => {
        setShowCelebration(false);
        setShowConfetti(false);

        if (lvl >= 2) {
          setShowAllMastered(true);
        } else {
          setShowReviewScreen(true);
        }
        fetchCourse();
      }, 3000);
    } else if (canRetry) {
      // Failed but can retry with different questions
      setLevelQuizSecondAttempt(true);
      // The LevelQuizPanel will regenerate questions
    } else {
      // Failed second attempt — still allow proceeding (user always moves on)
      setShowLevelQuiz(false);
      const lvl = completedLevel;
      if (lvl >= 2) {
        setShowAllMastered(true);
      } else {
        setShowReviewScreen(true);
      }
      fetchCourse();
    }
  }, [user?.firstName, lang, completedLevel, fetchCourse]);

  // ── Continue to next level ──
  const handleContinueToNextLevel = useCallback(async () => {
    if (!course || !selectedCourseId) return;
    const nextLevel = maxUnlockedLevel + 1;
    if (nextLevel > 2) return;

    setIsGeneratingLevel(true);
    setShowReviewScreen(false);
    setShowConfetti(false);

    try {
      const res = await fetch(`/api/courses/${selectedCourseId}/generate-level`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: nextLevel }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "SUBSCRIPTION_REQUIRED" || data.requiresSubscription) {
          // Redirect to offers page for subscription
          setShowReviewScreen(false);
          setView("offers");
          return;
        }
        throw new Error(data.error || "Failed to generate level");
      }

      const data = await res.json();
      if (data.chapters?.length > 0) {
        // Refetch course to get updated chapters
        const courseRes = await fetch(`/api/courses/${selectedCourseId}`);
        if (courseRes.ok) {
          const updatedCourse = await courseRes.json();
          setCourse(updatedCourse);
          // Navigate to first chapter of new level from updated data
          const firstNewIdx = updatedCourse.chapters.findIndex((ch: { level?: number }) => (ch.level ?? 0) === nextLevel);
          if (firstNewIdx >= 0) setCurrentChapterIndex(firstNewIdx);
        }
      }
    } catch {
      // show error
    } finally {
      setIsGeneratingLevel(false);
    }
  }, [course, selectedCourseId, maxUnlockedLevel, setCurrentChapterIndex, setView]);

  // ── Stop at current level ──
  const handleStopHere = useCallback(async () => {
    if (!selectedCourseId) return;
    try {
      await fetch(`/api/courses/${selectedCourseId}/stop-level`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      setShowReviewScreen(false);
      setShowConfetti(false);
      setShowStopConfirm(true);
      fetchCourse();
    } catch {
      // ignore
    }
  }, [selectedCourseId, fetchCourse]);

  const handleCloseStopConfirm = () => {
    setShowStopConfirm(false);
  };

  const handleCloseAllMastered = () => {
    setShowAllMastered(false);
    setView("library");
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isFullscreen) {
        if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goToNext(); }
        if (e.key === "ArrowLeft") { e.preventDefault(); goToPrev(); }
        if (e.key === "Escape") setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen, goToNext, goToPrev, setIsFullscreen]);

  // ══════════════════════════════════════════════════════════════════
  // LOCKED — grace period expired, subscription fully blocked
  // ══════════════════════════════════════════════════════════════════
  if (!loading && graceExpired) {
    return (
      <div className="flex items-center justify-center min-h-screen animate-fade-in px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-extrabold mb-3 gradient-text">
            {lang === "fr" ? "Cours verrouillé" : "Course locked"}
          </h2>
          <p className="text-muted-foreground mb-2">
            {lang === "fr"
              ? "Ta période de grâce de 3 jours est terminée."
              : "Your 3-day grace period has ended."}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            {lang === "fr"
              ? "Renouvelle ton abonnement pour retrouver l'accès à tous tes cours."
              : "Renew your subscription to regain access to all your courses."}
          </p>
          <button
            onClick={() => setView("offers")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night text-base font-extrabold hover:from-amber-400 hover:to-gold transition-all duration-300 cursor-pointer shadow-lg shadow-gold/25"
          >
            <Crown className="w-5 h-5" />
            {lang === "fr" ? "Voir les abonnements" : "See plans"}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // Loading / error state
  // ══════════════════════════════════════════════════════════════════
  if (!selectedCourseId || (fetchError && hasAttemptedFetch) || (hasAttemptedFetch && !loading && !course)) {
    return (
      <div className="flex items-center justify-center min-h-screen animate-fade-in">
        <div className="text-center">
          <div className="text-5xl mb-4 opacity-40">📚</div>
          <p className="text-muted-foreground text-lg mb-6">{tx.viewer.back}</p>
          <button onClick={() => setView("landing")} className="px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer">{tx.viewer.back}</button>
        </div>
      </div>
    );
  }

  if (loading || !course || !currentChapter) {
    return (
      <div className="flex items-center justify-center min-h-screen animate-fade-in">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-mauve mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">{tx.viewer.loading}</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // GENERATING NEXT LEVEL — full screen loading
  // ══════════════════════════════════════════════════════════════════
  if (isGeneratingLevel) {
    return (
      <>
        <Confetti active={true} />
        <div className="fixed inset-0 z-50 bg-night flex flex-col items-center justify-center animate-fade-in">
          <div className="text-7xl mb-6 animate-bounce">🚀</div>
          <h2 className="text-2xl font-extrabold gradient-text mb-3">
            {lang === "fr" ? "Génération du prochain niveau..." : "Generating next level..."}
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            {lang === "fr"
              ? `Niveau ${getLevelName(maxUnlockedLevel + 1)} en cours de création`
              : `Level ${getLevelName(maxUnlockedLevel + 1)} being created`}
          </p>
          <Loader2 className="w-8 h-8 animate-spin text-mauve" />
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // REVIEW SCREEN — show after level completion, before generating next
  // ══════════════════════════════════════════════════════════════════
  if (showReviewScreen) {
    const completedLevelData = completedLevel >= 0 ? completedLevel : maxUnlockedLevel;
    const levelChapters = course.chapters.filter((ch) => (ch.level ?? 0) === completedLevelData);
    const emoji = completedLevelData <= 1 ? "🚀" : "🏆";

    return (
      <>
        <Confetti active={true} big />
        <div className="fixed inset-0 z-50 bg-night/95 backdrop-blur-md flex items-center justify-center animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg mx-4 my-8 p-6 sm:p-8 rounded-3xl glass">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-4 animate-bounce">{emoji}</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold gradient-text mb-2">
                {tx.levelReview.completedLevel}
              </h2>
              <p className="text-muted-foreground text-sm">
                {lang === "fr" ? `Niveau ${getLevelName(completedLevelData)}` : `Level ${getLevelName(completedLevelData)}`}
              </p>
              <p className="text-gold font-bold text-lg mt-1">
                {lang === "fr"
                  ? `+${[50, 100, 150][Math.min(completedLevelData, 2)]} 🔥`
                  : `+${[50, 100, 150][Math.min(completedLevelData, 2)]} 🔥`}
              </p>
            </div>

            {/* Key Points / Chapter summaries */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-mauve-light uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {tx.levelReview.keyPoints}
              </h3>
              <div className="space-y-3">
                {levelChapters.map((ch) => (
                  <div key={ch.id} className="p-4 rounded-2xl bg-mauve/5 border border-mauve/10">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-foreground">{ch.title}</p>
                        {ch.summary && <p className="text-xs text-muted-foreground mt-1">{ch.summary}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            {isFreeUser ? (
              <>
                {/* Paywall banner for free users */}
                <div className="mb-6 p-4 rounded-2xl bg-gold/10 border border-gold/20 text-center">
                  <Crown className="w-6 h-6 text-gold mx-auto mb-2" />
                  <p className="text-foreground font-bold text-sm mb-1">
                    {lang === "fr"
                      ? `Pour continuer au niveau ${getLevelName(completedLevelData + 1)}, souscris à un abonnement Premium`
                      : `To continue to ${getLevelName(completedLevelData + 1)} level, subscribe to Premium`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lang === "fr"
                      ? "Débloque tous les niveaux et crée jusqu'à 4 cours par jour"
                      : "Unlock all levels and create up to 4 courses per day"}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setView("offers")}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night font-bold text-sm hover:from-amber-400 hover:to-gold transition-all cursor-pointer shadow-lg shadow-gold/25"
                  >
                    <Crown className="w-5 h-5" />
                    {lang === "fr" ? "Souscrire au Premium" : "Subscribe to Premium"}
                  </button>
                  <button
                    onClick={handleStopHere}
                    className="flex-1 px-6 py-4 rounded-full glass text-muted-foreground font-bold text-sm hover:bg-white/10 hover:text-foreground transition-all cursor-pointer border border-border/50"
                  >
                    {lang === "fr" ? "Non" : "No"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <p className="text-foreground font-bold text-sm">
                    {lang === "fr"
                      ? `Veux-tu passer au niveau ${getLevelName(completedLevelData + 1)} ?`
                      : `Do you want to advance to ${getLevelName(completedLevelData + 1)} level?`}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleContinueToNextLevel}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm hover:from-emerald-400 hover:to-emerald-500 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <Check className="w-5 h-5" />
                    {lang === "fr" ? "Oui" : "Yes"}
                  </button>
                  <button
                    onClick={handleStopHere}
                    className="flex-1 px-6 py-4 rounded-full glass text-muted-foreground font-bold text-sm hover:bg-white/10 hover:text-foreground transition-all cursor-pointer border border-border/50"
                  >
                    {lang === "fr" ? "Non" : "No"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STOP CONFIRMATION
  // ══════════════════════════════════════════════════════════════════
  if (showStopConfirm) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-night/90 backdrop-blur-md flex items-center justify-center animate-fade-in">
          <div className="w-full max-w-md mx-4 p-8 rounded-3xl glass text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-extrabold gradient-text mb-2">{tx.levelReview.stopConfirmTitle}</h2>
            <p className="text-muted-foreground text-sm mb-2">{tx.levelReview.courseName} <span className="text-foreground font-bold">{course.title}</span></p>
            <p className="text-muted-foreground text-sm mb-6">{tx.levelReview.stopConfirmDesc}</p>
            <div className="space-y-3">
              <button
                onClick={handleCloseStopConfirm}
                className="w-full px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold text-sm hover:from-mauve-light hover:to-mauve transition-all cursor-pointer"
              >
                {tx.levelReview.backToStudy}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // ALL LEVELS MASTERED — BIG celebration
  // ══════════════════════════════════════════════════════════════════
  if (showAllMastered) {
    return (
      <>
        <Confetti active={true} big />
        <div className="fixed inset-0 z-50 bg-night/95 backdrop-blur-md flex items-center justify-center animate-fade-in overflow-y-auto">
          <div className="w-full max-w-md mx-4 my-8 p-8 rounded-3xl glass text-center">
            <div className="text-8xl mb-4 animate-bounce">🏆</div>
            <h2 className="text-3xl font-extrabold gradient-text mb-2">{tx.levelReview.allLevelsComplete}</h2>
            <p className="text-foreground font-bold text-lg mb-1">
              {user?.firstName ? (lang === "fr" ? `Bravo ${user.firstName} !` : `Great job ${user.firstName}!`) : ""}
            </p>
            <p className="text-muted-foreground text-sm mb-4">{course.title}</p>
            <p className="text-muted-foreground text-sm mb-6">{tx.levelReview.allLevelsCompleteDesc}</p>

            <div className="space-y-2 mb-8">
              <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold/10 border border-gold/20">
                <span className="font-bold text-gold">{tx.levelReview.flameBonus.replace("{points}", "500")}</span>
              </div>
              <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="font-bold text-emerald-400">{tx.levelReview.masteryBadge}</span>
              </div>
            </div>

            <button
              onClick={handleCloseAllMastered}
              className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer"
            >
              {tx.viewer.back}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // COURSE COMPLETED OVERVIEW
  // ══════════════════════════════════════════════════════════════════
  if (courseCompleted && !showFinalQuiz && !showCelebration && !showReviewScreen && !showStopConfirm && !showAllMastered) {
    return (
      <>
        <Confetti active={false} />
        <div className="flex flex-col h-screen overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-night-light flex-shrink-0">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-gold" />
              <div>
                <h2 className="text-lg font-bold gradient-text">{course.title}</h2>
                <p className="text-xs text-emerald-400 font-semibold">{tx.viewer.courseComplete}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">100%</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <div className="text-6xl mb-4">🎓</div>
                <h2 className="text-2xl font-extrabold gradient-text mb-2">{tx.viewer.courseComplete}</h2>
                <p className="text-muted-foreground">{lang === "fr" ? "Tu peux rejouer n'importe quel chapitre" : "You can replay any chapter"}</p>
              </div>
              <div className="space-y-3">
                {course.chapters.map((ch, idx) => {
                  const isActive = idx === currentChapterIndex;
                  return (
                    <button key={ch.id} onClick={() => { setCurrentChapterIndex(idx); setCourseCompleted(false); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer group ${isActive ? "bg-mauve/15 border-2 border-mauve/30" : "glass hover:bg-white/5"}`}>
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{ch.title}</p>
                        <p className="text-xs text-muted-foreground">{tx.viewer.chapterOf(idx + 1, course.chapters.length)}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">{tx.viewer.completed}</span>
                    </button>
                  );
                })}
              </div>
              <div className="text-center mt-8">
                <button onClick={() => setView("library")} className="px-8 py-3 rounded-full glass font-bold text-sm hover:bg-white/10 transition-all cursor-pointer">{tx.viewer.back}</button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // LEVEL QUIZ MODE
  // ══════════════════════════════════════════════════════════════════
  if (showLevelQuiz) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-night-light flex-shrink-0">
          <div className="flex items-center gap-3">
            <CoursiaLogo size={32} className="rounded-lg" />
            <div>
              <p className="text-sm text-muted-foreground">{course?.title}</p>
              <p className="font-bold gradient-text">
                {lang === "fr" ? "Quiz" : "Quiz"} {getLevelName(levelQuizLevel)} {LEVEL_EMOJIS[Math.min(levelQuizLevel, 2)]}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowLevelQuiz(false); }}
            className="p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
            title={lang === "fr" ? "Retourner à l'étude" : "Back to study"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <LevelQuizPanel
            courseId={selectedCourseId}
            level={levelQuizLevel}
            isSecondAttempt={levelQuizSecondAttempt}
            isFreeUser={isFreeUser}
            onComplete={(passed, pointsEarned, canRetry) => handleLevelQuizComplete(passed, pointsEarned, canRetry)}
            onBack={() => { setShowLevelQuiz(false); }}
          />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // FINAL QUIZ MODE
  // ══════════════════════════════════════════════════════════════════
  if (showFinalQuiz) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-night-light flex-shrink-0">
          <div className="flex items-center gap-3">
            <CoursiaLogo size={32} className="rounded-lg" />
            <div>
              <h2 className="text-lg font-bold">{tx.viewer.finalQuiz}</h2>
              <p className="text-xs text-muted-foreground">{course.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20">
            <AlertTriangle className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-bold text-gold">{tx.viewer.finalQuizRequired}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            <div className="mb-8 p-4 rounded-2xl bg-gold/5 border border-gold/20 text-center">
              <p className="text-sm font-semibold text-gold">{tx.viewer.finalQuizRequiredDesc}</p>
            </div>
            <QuizPanel courseId={course.id} isFinalQuiz={true} onComplete={handleFinalQuizComplete} onBack={() => {}} />
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // FULLSCREEN OVERLAY
  // ══════════════════════════════════════════════════════════════════
  if (isFullscreen) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-night flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsFullscreen(false)} className="p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer"><Minimize2 className="w-5 h-5" /></button>
              <div>
                <p className="text-sm text-muted-foreground">{course.title}</p>
                <p className="font-bold gradient-text">{tx.viewer.chapterOf(currentChapterIndex + 1, course.chapters.length)} : <span>{currentChapter.title}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full glass">
                <span className="text-sm font-semibold">{completedCount} / {totalChapters}</span>
                <div className="w-32 h-2 rounded-full bg-night overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-mauve to-gold transition-all duration-1000 ease-out" style={{ width: `${overallProgress}%` }} />
                </div>
              </div>
              <button onClick={goToPrev} disabled={currentChapterIndex === 0 || isCompleting} className="p-2 rounded-xl hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={goToNext} disabled={currentChapterIndex === course.chapters.length - 1} className="p-2 rounded-xl hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-10">
              {currentChapter.summary && (
                <div className="mb-8 p-5 rounded-2xl bg-mauve/5 border border-mauve/10 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-mauve-light" />
                    <span className="text-xs font-bold text-mauve-light uppercase tracking-wider">{tx.viewer.summary}</span>
                  </div>
                  <p className="text-lg sm:text-xl text-foreground/80 leading-relaxed">{currentChapter.summary}</p>
                </div>
              )}
              <div key={`fs-chapter-${currentChapter.id}-${currentChapterIndex}`} className="prose prose-invert max-w-none text-[24px] leading-[1.75] animate-fade-in-slide-right prose-p:text-[1.6rem] prose-p:leading-[1.75] prose-p:mb-4 prose-h2:text-[2.3rem] prose-h2:mt-10 prose-h2:mb-5 prose-h3:text-[2rem] prose-h3:mt-8 prose-h3:mb-4 prose-li:text-[1.6rem] prose-li:my-1.5 prose-li:leading-[1.75] prose-ul:my-4 prose-ol:my-4 prose-strong:text-gold prose-hr:border-gold/20 prose-hr:my-8">
                <ReactMarkdown>{currentChapter.content || ""}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
        {showCelebration && <Confetti active={true} />}
        {showCelebration && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-night/80 backdrop-blur-sm animate-fade-in">
            <div className="text-center p-12 rounded-3xl glass animate-celebrate relative">
              <div className="text-6xl mb-6">🎉</div>
              <h2 className="text-3xl font-extrabold gradient-text mb-4 animate-fade-in-slide-up">{useAppStore.getState().celebrationMessage}</h2>
            </div>
          </div>
        )}
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // NORMAL VIEW — sidebar + content layout
  // ══════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ─── Grace period banner ─── */}
      {inGracePeriod && !graceExpired && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 backdrop-blur-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs sm:text-sm text-amber-200 font-medium flex-1">
            {lang === "fr"
              ? `Ton abonnement est terminé. Tu peux encore lire tes cours pendant ${graceDaysRemaining} jour${graceDaysRemaining > 1 ? "s" : ""}. Renouvelle maintenant !`
              : `Your subscription has ended. You can still read your courses for ${graceDaysRemaining} day${graceDaysRemaining > 1 ? "s" : ""}. Renew now!`}
          </p>
          <button
            onClick={() => setView("offers")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-200 text-xs font-bold hover:bg-amber-500/30 transition-all cursor-pointer flex-shrink-0"
          >
            {lang === "fr" ? "Renouveler" : "Renew"}
          </button>
        </div>
      )}
      <div className={`flex h-screen overflow-hidden pb-14 md:pb-0 ${inGracePeriod && !graceExpired ? "pt-10" : ""}`}>
        {/* ─── Sidebar: Chapter navigation (hidden on mobile) ─── */}
        <div className="hidden md:flex w-64 border-r border-border bg-night-light flex-col flex-shrink-0">
          <div className="p-4 border-b border-border">
            <h2 className="font-bold text-sm leading-tight line-clamp-2 mb-3">{course.title}</h2>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold text-mauve-light">{completedCount}/{totalChapters} {lang === "fr" ? "chapitres" : "chapters"}</span>
              <span className="font-bold">{overallProgress}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-night overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-mauve to-gold transition-all duration-1000 ease-out" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>

          <div ref={chapterListRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            {chaptersByLevel.map((group) => {
              const isLevelLocked = group.level > maxUnlockedLevel;
              const isLevelStopped = isStopped && group.level > stoppedAtLevel;
              return (
                <div key={group.level}>
                  {/* Level header */}
                  <div className={`flex items-center gap-2 px-3 py-2 mt-2 first:mt-0 ${isLevelLocked || isLevelStopped ? "opacity-40" : ""}`}>
                    <span className="text-sm">{LEVEL_EMOJIS[group.level]}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {lang === "fr" ? "Niveau" : "Level"} {group.level + 1}: {getLevelName(group.level)}
                    </span>
                    {isLevelLocked && !isLevelStopped && (
                      <Lock className="w-3 h-3 text-muted-foreground/40 ml-auto" />
                    )}
                    {isLevelStopped && (
                      <Lock className="w-3 h-3 text-destructive/60 ml-auto" />
                    )}
                  </div>

                  {/* Chapters in this level */}
                  {group.chapters.map(({ chapter: ch, globalIdx: idx }) => {
                    const isActive = idx === currentChapterIndex;
                    const isUnlocked = isChapterUnlocked(idx);
                    const isCompleted = ch.progress?.completed;
                    const isLocked = isChapterLevelLocked(idx);
                    const subChapters = chapterSubChapters[ch.id] || [];
                    const hasSubChapters = subChapters.length > 0;
                    const visibleSubs = subChapters.slice(0, 3);
                    const remainingSubs = subChapters.length - 3;
                    const isExpanded = expandedChapters.has(idx);

                    return (
                      <div key={ch.id} data-chapter-idx={idx}>
                        <button
                          onClick={() => {
                            if (isUnlocked) {
                              setCurrentChapterIndex(idx);
                              if (!isActive && hasSubChapters) {
                                setExpandedChapters((prev) => { const n = new Set(prev); n.add(idx); return n; });
                              }
                            }
                          }}
                          disabled={!isUnlocked}
                          className={`w-full text-left p-3 rounded-xl transition-all duration-200 cursor-pointer group ${
                            isActive ? "bg-mauve/15 border border-mauve/30 text-foreground shadow-sm"
                              : isCompleted ? "hover:bg-white/5 text-foreground border border-transparent"
                              : isUnlocked ? "hover:bg-white/5 text-muted-foreground hover:text-foreground border border-transparent"
                              : "opacity-40 text-muted-foreground cursor-not-allowed border border-transparent"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center">
                              {isLocked ? (
                                <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                              ) : isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              ) : isUnlocked ? (
                                isActive ? (
                                  <BookOpen className="w-4 h-4 text-mauve-light" />
                                ) : (
                                  <div className="w-6 h-6 rounded-lg bg-mauve/15 border border-mauve/25 flex items-center justify-center">
                                    <span className="text-[11px] font-extrabold text-mauve-light">{idx + 1}</span>
                                  </div>
                                )
                              ) : (
                                <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-semibold line-clamp-2 leading-snug ${isActive ? "text-mauve-light" : ""}`}>{ch.title}</p>
                              {isCompleted && <p className="text-[10px] text-green-400 mt-0.5">{tx.viewer.completed}</p>}
                            </div>
                            {isUnlocked && hasSubChapters && (
                              <div onClick={(e) => { e.stopPropagation(); toggleChapterExpanded(idx); }}
                                className={`flex-shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center cursor-pointer transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>
                        </button>
                        {isUnlocked && hasSubChapters && isExpanded && (
                          <div className="ml-7 mt-1 mb-1 animate-subchapter-expand">
                            {visibleSubs.map((sub, si) => (
                              <div key={si} className="flex items-center gap-2 py-0.5">
                                <span className="w-1 h-1 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                                <span className="text-[10px] leading-snug text-muted-foreground/70 line-clamp-1">{sub}</span>
                              </div>
                            ))}
                            {remainingSubs > 0 && (
                              <div className="flex items-center gap-2 py-0.5">
                                <span className="w-1 h-1 rounded-full bg-muted-foreground/20 flex-shrink-0" />
                                <span className="text-[10px] text-muted-foreground/40 font-medium">+{remainingSubs} {lang === "fr" ? "autres" : "more"}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Final quiz trigger */}
          {allChaptersCompleted && !isStopped && (
            <div className="p-3 border-t border-border">
              <button onClick={() => setShowFinalQuiz(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-night text-xs font-bold hover:from-gold-light hover:to-gold transition-all cursor-pointer shadow-lg shadow-gold/20">
                <Trophy className="w-4 h-4" />
                {tx.viewer.finalQuiz}
              </button>
            </div>
          )}
        </div>

        {/* ─── Main content area ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile chapter dropdown */}
          <div className="md:hidden border-b border-border bg-night-light flex-shrink-0">
            <div className="px-3 py-2.5">
              <button onClick={() => setMobileChapterOpen(!mobileChapterOpen)} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl glass text-left cursor-pointer transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-mauve/15 flex items-center justify-center flex-shrink-0"><BookOpen className="w-4 h-4 text-mauve-light" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-muted-foreground truncate">{tx.viewer.chapterOf(currentChapterIndex + 1, totalChapters)}</p>
                    <p className="text-[13px] font-bold text-foreground truncate">{currentChapter.title}</p>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${mobileChapterOpen ? "rotate-180" : ""}`} />
              </button>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-1.5 rounded-full bg-night overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-mauve to-gold transition-all duration-1000 ease-out" style={{ width: `${overallProgress}%` }} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{completedCount}/{totalChapters}</span>
              </div>
            </div>
            {mobileChapterOpen && (
              <div className="border-t border-border max-h-64 overflow-y-auto custom-scrollbar">
                {chaptersByLevel.map((group) => (
                  <div key={group.level}>
                    <div className={`flex items-center gap-2 px-4 py-1.5 ${group.level > maxUnlockedLevel ? "opacity-40" : ""}`}>
                      <span className="text-xs">{LEVEL_EMOJIS[group.level]}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{getLevelName(group.level)}</span>
                    </div>
                    {group.chapters.map(({ chapter: ch, globalIdx: idx }) => {
                      const isActive = idx === currentChapterIndex;
                      const isUnlocked = isChapterUnlocked(idx);
                      const isCompleted = ch.progress?.completed;
                      return (
                        <button key={ch.id} onClick={() => { if (isUnlocked) { setCurrentChapterIndex(idx); setMobileChapterOpen(false); } }}
                          disabled={!isUnlocked}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all cursor-pointer border-b border-border/50 last:border-b-0 ${isActive ? "bg-mauve/10" : isUnlocked ? "hover:bg-white/5" : "opacity-40"}`}>
                          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                            {isChapterLevelLocked(idx) ? <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                              : isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                              : isActive ? <BookOpen className="w-4 h-4 text-mauve-light" />
                              : <div className="w-6 h-6 rounded-lg bg-mauve/15 border border-mauve/25 flex items-center justify-center"><span className="text-[10px] font-extrabold text-mauve-light">{idx + 1}</span></div>}
                          </div>
                          <p className={`text-sm font-semibold line-clamp-1 ${isActive ? "text-mauve-light" : isUnlocked ? "text-foreground" : "text-muted-foreground"}`}>{ch.title}</p>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Content header */}
          <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold gradient-text">{currentChapter.title}</h2>
              <p className="text-sm text-muted-foreground font-semibold">
                {tx.viewer.chapterOf(currentChapterIndex + 1, totalChapters)}
                {!currentChapter.progress?.completed && <span className="ml-2 text-mauve-light">— {lang === "fr" ? "En cours" : "In progress"}</span>}
                {currentChapter.progress?.completed && <span className="ml-2 text-green-400">— {tx.viewer.completed} ✓</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowShareDialog(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-full glass text-xs font-bold hover:bg-mauve/10 hover:text-mauve-light transition-all cursor-pointer">
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{lang === "fr" ? "Inviter un ami" : "Invite a Friend"}</span>
              </button>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass text-[10px] font-bold text-muted-foreground">
                <span>{LEVEL_EMOJIS[currentChapter.level ?? 0]}</span>
                <span>{getLevelName(currentChapter.level ?? 0)}</span>
              </div>
              <button onClick={() => setIsFullscreen(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-full glass text-xs font-bold hover:bg-white/10 transition-all cursor-pointer">
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{tx.viewer.enlarge}</span>
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div key={`chapter-${currentChapter.id}-${currentChapterIndex}`} className="max-w-3xl mx-auto px-4 sm:px-5 md:px-6 py-5 sm:py-6 md:py-8 animate-fade-in-slide-right">
              <div className="md:hidden flex justify-end gap-2 mb-4">
                <button onClick={() => setShowShareDialog(true)} className="p-2 rounded-xl glass text-xs font-bold hover:bg-mauve/10 hover:text-mauve-light transition-all cursor-pointer"><Share2 className="w-4 h-4 text-muted-foreground" /></button>
                <button onClick={() => setIsFullscreen(true)} className="p-2 rounded-xl glass text-xs font-bold hover:bg-white/10 transition-all cursor-pointer"><Maximize2 className="w-4 h-4 text-muted-foreground" /></button>
              </div>

              {currentChapter.summary && (
                <div className="mb-6 sm:mb-8 p-4 sm:p-5 rounded-2xl bg-mauve/5 border border-mauve/10">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-mauve-light" />
                    <span className="text-xs font-bold text-mauve-light uppercase tracking-wider">{tx.viewer.summary}</span>
                  </div>
                  <p className="text-base sm:text-lg text-foreground/80 leading-relaxed">{currentChapter.summary}</p>
                </div>
              )}

              <div className="prose prose-invert max-w-none text-[20px] sm:text-[24px] leading-[1.7] sm:leading-[1.75]
                prose-headings:font-extrabold
                prose-h1:text-3xl sm:text-5xl prose-h1:mt-8 sm:mt-10 prose-h1:mb-3 sm:mb-4
                prose-h2:text-[1.7rem] sm:text-[2.3rem] prose-h2:mt-8 sm:mt-10 prose-h2:mb-4 sm:mb-5
                prose-h3:text-[1.5rem] sm:text-[2rem] prose-h3:mt-6 sm:mt-8 prose-h3:mb-3 sm:mb-4
                prose-p:text-[1.3rem] sm:text-[1.6rem] prose-p:leading-[1.7] sm:leading-[1.75] prose-p:text-foreground/90 prose-p:mb-3 sm:mb-4
                prose-li:text-[1.3rem] sm:text-[1.6rem] prose-li:text-foreground/90 prose-li:leading-[1.7] sm:leading-[1.75] prose-li:my-1 sm:my-1.5
                prose-ul:my-4 sm:my-5 prose-ol:my-4 sm:my-5
                prose-strong:text-gold
                prose-code:text-gold-light prose-code:bg-mauve/10 prose-code:px-2 prose-code:py-1 prose-code:rounded-lg prose-code:text-[0.9rem] sm:text-1rem
                prose-pre:bg-night prose-pre:border prose-pre:border-border prose-pre:rounded-2xl prose-pre:py-4 sm:py-6 prose-pre:text-[0.9rem] sm:text-1rem
                prose-a:text-mauve-light
                prose-blockquote:text-amber-300 prose-blockquote:border-gold/30 prose-blockquote:my-4 sm:my-6
                prose-hr:border-gold/20 prose-hr:my-6 sm:my-8
              ">
                <ReactMarkdown>{currentChapter.content || ""}</ReactMarkdown>
              </div>

              {/* Navigation footer */}
              <div className="flex items-center justify-between mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border">
                <button onClick={goToPrev} disabled={currentChapterIndex === 0 || isCompleting} className="flex items-center gap-2 px-4 md:px-6 py-3 rounded-full glass text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{tx.viewer.previous}</span>
                </button>
                {currentChapterIndex < course.chapters.length - 1 ? (
                  <button onClick={goToNext} className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-sm font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer">
                    {tx.viewer.next}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : !isStopped ? (
                  <button onClick={handleCompleteLevel} disabled={isCompleting} className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-gold to-gold-dark text-night text-sm font-bold hover:from-gold-light hover:to-gold transition-all cursor-pointer">
                    {isCompleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><Trophy className="w-4 h-4" />{currentChapter.progress?.completed ? (lang === "fr" ? "Niveau suivant" : "Next level") : (lang === "fr" ? "Terminer le niveau" : "Complete level")}</>
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Celebration overlay */}
      {showCelebration && <Confetti active={true} big />}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 backdrop-blur-sm animate-fade-in">
          <div className="text-center p-12 rounded-3xl glass animate-celebrate relative">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-3xl font-extrabold gradient-text mb-4 animate-fade-in-slide-up">{useAppStore.getState().celebrationMessage}</h2>
          </div>
        </div>
      )}
      <ShareCourseDialog
        courseId={course?.id || ""}
        courseTitle={course?.title || ""}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
      />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Level Quiz Panel — shown at the end of each level (7 questions, 4/7 to pass)
   ════════════════════════════════════════════════════════════════════ */

function LevelQuizPanel({
  courseId,
  level,
  isSecondAttempt,
  isFreeUser: isFreeUserProp,
  onComplete,
  onBack,
}: {
  courseId: string;
  level: number;
  isSecondAttempt: boolean;
  isFreeUser?: boolean;
  onComplete: (passed: boolean, pointsEarned: number, canRetry: boolean) => void;
  onBack: () => void;
}) {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; total: number; passed: boolean; pointsEarned: number; canRetry: boolean } | null>(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      setLoading(true);
      setResult(null);
      setAnswers({});
      try {
        const res = await fetch(`/api/courses/${courseId}/level-quiz`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level, regenerate: true }),
        });
        const data = await res.json();
        if (res.ok && data.quiz) {
          setQuestions(data.quiz.questions);
        }
      } catch { /* ignore */ }
      setLoading(false);
      // Restore saved answers (e.g., after returning from payment page)
      const savedKey = `coursia-quiz-answers-${courseId}-level-${level}`;
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(savedKey);
        if (saved) {
          try { setAnswers(JSON.parse(saved)); } catch { /* ignore */ }
        }
      }
    };
    fetchQuiz();
  }, [courseId, level, isSecondAttempt]); // regenerate on second attempt

  const handleSubmit = async () => {
    if (submitting) return;

    // Free user trying to submit quiz: save answers and redirect to offers
    // Blocking happens at ALL levels — free users can study but not get quiz correction
    if (isFreeUserProp) {
      const key = `coursia-quiz-answers-${courseId}-level-${level}`;
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(answers));
      }
      useAppStore.getState().setView("offers");
      return;
    }

    setSubmitting(true);

    // Calculate score locally
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correct++;
    });

    const total = questions.length;
    const passed = correct >= 4;
    const pointsEarned = correct;

    try {
      const userId = useAppStore.getState().userId;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userId) headers["Authorization"] = `Bearer ${userId}`;
      await fetch(`/api/courses/${courseId}/level-quiz`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ level, answers, isSecondAttempt, score: Math.round((correct / total) * 100), correct, total, questions, userId }),
      });
    } catch { /* non-critical */ }

    setResult({ score: Math.round((correct / total) * 100), correct, total, passed, pointsEarned, canRetry: !passed && !isSecondAttempt });
    setSubmitting(false);

    // Clean up saved quiz answers from localStorage (no longer needed after submission)
    const savedKey = `coursia-quiz-answers-${courseId}-level-${level}`;
    if (typeof window !== "undefined") {
      localStorage.removeItem(savedKey);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center animate-pulse">
          <div className="text-4xl mb-4">🧠</div>
          <p className="text-muted-foreground font-medium">{lang === "fr" ? "Préparation du quiz..." : "Preparing quiz..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="text-4xl mb-3">📝</div>
        <h2 className="text-2xl font-extrabold gradient-text mb-2">
          {isSecondAttempt
            ? (lang === "fr" ? "Deuxième chance !" : "Second chance!")
            : (lang === "fr" ? `Quiz du niveau ${["Débutant", "Intermédiaire", "Avancé"][Math.min(level, 2)]}` : `Level ${["Beginner", "Intermediate", "Advanced"][Math.min(level, 2)]} Quiz`)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {lang === "fr"
            ? `${questions.length} questions — ${4} bonnes réponses minimum pour réussir`
            : `${questions.length} questions — ${4} correct answers needed to pass`}
        </p>
        {isSecondAttempt && (
          <p className="text-xs text-amber-400 mt-2">
            {lang === "fr" ? "Les questions sont différentes cette fois-ci !" : "The questions are different this time!"}
          </p>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((q, qi) => (
          <div key={qi} className="p-5 rounded-2xl glass animate-fade-in" style={{ animationDelay: `${qi * 100}ms` }}>
            <p className="font-bold text-foreground mb-3">
              <span className="text-mauve-light">{qi + 1}.</span> {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isSelected = answers[qi] === oi;
                const isCorrect = result && oi === q.correctIndex;
                const isWrong = result && isSelected && oi !== q.correctIndex;
                return (
                  <button
                    key={oi}
                    onClick={() => !result && setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                    disabled={!!result}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm cursor-pointer
                      ${result
                        ? isCorrect
                          ? "border-green-500/50 bg-green-500/10 text-green-300"
                          : isWrong
                            ? "border-red-500/50 bg-red-500/10 text-red-300"
                            : "border-border/50 text-muted-foreground"
                        : isSelected
                          ? "border-mauve/50 bg-mauve/10 text-mauve-light"
                          : "border-border/50 hover:border-mauve/30 hover:bg-white/5 text-foreground"
                      }`}
                  >
                    <span className="font-medium">{String.fromCharCode(97 + oi)})</span> {opt}
                    {isCorrect && <Check className="inline w-4 h-4 ml-2 text-green-400" />}
                    {isWrong && <X className="inline w-4 h-4 ml-2 text-red-400" />}
                  </button>
                );
              })}
            </div>
            {result && q.explanation && (
              <p className="mt-3 text-xs text-muted-foreground bg-white/5 rounded-lg p-3">
                💡 {q.explanation}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Submit / Result */}
      <div className="mt-8 text-center">
        {/* Paywall notice for free users — quiz correction requires subscription */}
        {isFreeUserProp && !result && (
          <div className="mb-4 p-4 rounded-2xl bg-gold/10 border border-gold/20">
            <Crown className="w-5 h-5 text-gold mx-auto mb-2" />
            <p className="text-foreground font-bold text-sm mb-1">
              {lang === "fr"
                ? "Pour corriger ton quiz et voir tes résultats, souscris à Premium"
                : "To grade your quiz and see your results, subscribe to Premium"}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {lang === "fr"
                ? "Tes réponses seront sauvegardées et corrigées après ton abonnement"
                : "Your answers will be saved and graded after subscribing"}
            </p>
            <button
              onClick={() => setView("offers")}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-gold to-amber-500 text-night text-sm font-bold hover:from-amber-400 hover:to-gold transition-all cursor-pointer"
            >
              <Crown className="w-4 h-4" />
              {lang === "fr" ? "Souscrire au Premium" : "Subscribe to Premium"}
            </button>
          </div>
        )}
        {!result ? (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < questions.length || submitting}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (lang === "fr" ? "Valider mes réponses" : "Submit answers")}
          </button>
        ) : (
          <div className="animate-fade-in">
            <div className={`text-3xl font-extrabold mb-2 ${result.passed ? "text-green-400" : "text-red-400"}`}>
              {result.correct}/{result.total}
            </div>
            <p className="text-lg font-bold mb-1">
              {result.passed
                ? (lang === "fr" ? "Quiz réussi ! 🎉" : "Quiz passed! 🎉")
                : (lang === "fr" ? "Quiz non réussi" : "Quiz not passed")}
            </p>
            <p className="text-sm text-muted-foreground mb-1">
              {lang === "fr" ? `+${result.pointsEarned} points de flamme` : `+${result.pointsEarned} flame points`}
            </p>
            {result.canRetry && (
              <p className="text-xs text-amber-400 mb-4">
                {lang === "fr" ? "Tu as une deuxième chance avec des questions différentes !" : "You get a second chance with different questions!"}
              </p>
            )}
            <div className="flex items-center justify-center gap-3">
              {result.canRetry ? (
                <button
                  onClick={() => { setResult(null); setAnswers({}); }}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-gold text-night text-sm font-bold hover:from-amber-400 hover:to-gold-light transition-all cursor-pointer"
                >
                  {lang === "fr" ? "Réessayer" : "Retry"}
                </button>
              ) : null}
              <button
                onClick={() => onComplete(result.passed, result.pointsEarned, result.canRetry)}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-sm font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer"
              >
                {result.passed
                  ? (lang === "fr" ? "Continuer" : "Continue")
                  : (lang === "fr" ? "Continuer quand même" : "Continue anyway")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Quiz Panel — only for final quiz now
   ════════════════════════════════════════════════════════════════════ */

function QuizPanel({
  courseId,
  isFinalQuiz,
  onComplete,
  onBack,
}: {
  chapterId?: string;
  courseId: string;
  isFinalQuiz: boolean;
  onComplete: (passed: boolean) => void;
  onBack: () => void;
}) {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; total: number; passed: boolean } | null>(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const url = `/api/courses/${courseId}/final-quiz`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerate: true }),
        });
        const data = await res.json();
        if (res.ok && data.quiz) {
          setQuestions(data.quiz.questions);
        }
      } catch { /* fail silently */ }
      finally { setLoading(false); }
    };
    fetchQuiz();
  }, [courseId, isFinalQuiz]);

  const submitQuiz = async () => {
    setSubmitting(true);
    try {
      const userId = useAppStore.getState().userId;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userId) headers["Authorization"] = `Bearer ${userId}`;
      const url = `/api/courses/${courseId}/final-quiz`;
      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ answers, userId }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setResult(data.result);
        if (data.result.passed) {
          setTimeout(() => onComplete(true), 2000);
        }
      }
    } catch { /* fail silently */ }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-mauve" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="text-center py-8 animate-fade-in">
        <div className="text-5xl mb-4">{result.passed ? "🎉" : "😔"}</div>
        <h3 className={`text-2xl font-extrabold mb-2 ${result.passed ? "gradient-text" : "text-destructive"}`}>
          {result.passed ? tx.viewer.bravo : tx.viewer.almost}
        </h3>
        <p className="text-muted-foreground mb-4">
          {tx.viewer.score}: {result.correct}/{result.total} ({Math.round((result.correct / result.total) * 100)}%)
        </p>
        {result.passed && (
          <p className="text-emerald-400 font-bold text-sm">{tx.viewer.finalPassed}</p>
        )}
        {!result.passed && (
          <p className="text-sm text-muted-foreground mb-4">{tx.viewer.retryDesc}</p>
        )}
        {!result.passed && (
          <button onClick={() => { setResult(null); setAnswers({}); }} className="px-6 py-3 rounded-full glass font-bold text-sm hover:bg-white/10 transition-all cursor-pointer">
            {tx.viewer.redoQuiz}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((q, qIdx) => {
        const userAnswer = answers[qIdx];
        const isCorrect = userAnswer === q.correctIndex;
        return (
          <div key={qIdx} className={`p-5 rounded-2xl glass ${result ? (isCorrect ? "border-emerald-500/30" : "border-destructive/30") : ""}`}>
            <p className="font-bold text-sm mb-4">
              <span className="text-mauve-light">{qIdx + 1}.</span> {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oIdx) => {
                const isSelected = answers[qIdx] === oIdx;
                const showCorrect = result !== null;
                return (
                  <button
                    key={oIdx}
                    onClick={() => { if (result === null) setAnswers({ ...answers, [qIdx]: oIdx }); }}
                    disabled={result !== null}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer ${
                      showCorrect && oIdx === q.correctIndex
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-semibold"
                        : showCorrect && isSelected && !isCorrect
                          ? "bg-destructive/15 border border-destructive/30 text-destructive font-semibold"
                          : isSelected && !showCorrect
                            ? "bg-mauve/20 border border-mauve/40 text-mauve-light font-semibold"
                            : "border border-border hover:bg-white/5 text-muted-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {showCorrect && oIdx === q.correctIndex && <Check className="w-4 h-4" />}
                      {showCorrect && isSelected && !isCorrect && <X className="w-4 h-4" />}
                      {opt}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Show explanation after quiz is submitted */}
            {result && q.explanation && (
              <div className="mt-3 p-3 rounded-xl bg-mauve/10 border border-mauve/20">
                <p className="text-xs font-bold text-mauve-light mb-1">💡 Explication</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
              </div>
            )}
          </div>
        );
      })}
      <div className="text-center">
        <button
          onClick={submitQuiz}
          disabled={submitting || Object.keys(answers).length < questions.length}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-gold to-gold-dark text-night font-bold text-sm hover:from-gold-light hover:to-gold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-gold/20"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : tx.viewer.submit}
        </button>
        {Object.keys(answers).length < questions.length && (
          <p className="text-xs text-muted-foreground mt-3">{tx.viewer.answerAll}</p>
        )}
      </div>
    </div>
  );
}
