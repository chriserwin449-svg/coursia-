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
  Lock,
  Loader2,
  BookOpen,
  Trophy,
  FileText,
  AlertTriangle,
  Rocket,
  Crown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
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
  const [studySessionId, setStudySessionId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [mobileChapterOpen, setMobileChapterOpen] = useState(false);

  // Subscription state for free chapter limit
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [freeChapterLimit, setFreeChapterLimit] = useState(1);
  // Paywall state for grace period / locked access
  const [canStudy, setCanStudy] = useState(true);
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [graceDaysRemaining, setGraceDaysRemaining] = useState(0);
  const [graceExpired, setGraceExpired] = useState(false);

  // Level system states
  const [isGeneratingLevel, setIsGeneratingLevel] = useState(false);
  const [showReviewScreen, setShowReviewScreen] = useState(false);
  const [completedLevel, setCompletedLevel] = useState(-1);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showAllMastered, setShowAllMastered] = useState(false);

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
    const chLevel = ch.level ?? 0;
    // Locked if chapter level exceeds maxUnlockedLevel
    if (chLevel > maxUnlockedLevel) return true;
    // If stopped, lock chapters above stoppedAtLevel
    if (isStopped && chLevel > stoppedAtLevel) return true;
    return false;
  };

  const isChapterUnlocked = (index: number) => {
    if (isChapterLevelLocked(index)) return false;
    // Free preview: lock chapters beyond freeChapterLimit for non-subscribers
    if (!isSubscribed && index >= freeChapterLimit) return false;
    if (index === 0) return true;
    return course?.chapters[index - 1]?.progress?.completed === true;
  };

  // ── Study session tracking ──
  const startStudySession = useCallback(async (cId: string, chId?: string) => {
    try {
      const res = await fetch("/api/study-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", courseId: cId, chapterId: chId }),
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
      await fetch("/api/study-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", sessionId: studySessionId }),
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
          body: JSON.stringify({ action: "end", sessionId: studySessionId }),
        }).catch(() => {});
      }
    };
  }, [studySessionId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (studySessionId) {
        navigator.sendBeacon("/api/study-time", new Blob([JSON.stringify({ action: "end", sessionId: studySessionId })], { type: "application/json" }));
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [studySessionId]);

  const fetchCourse = useCallback(async () => {
    if (!selectedCourseId) return;
    setLoading(true);
    setFetchError(false);
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
        setIsSubscribed(!!pw.hasSubscription && pw.subscriptionStatus === "active");
        setFreeChapterLimit(pw.freeChapterLimit || 1);
        setCanStudy(pw.canStudy !== false);
        setInGracePeriod(!!pw.inGracePeriod);
        setGraceDaysRemaining(pw.graceDaysRemaining || 0);
        setGraceExpired(pw.showPaywall && pw.paywallReason === "grace_expired");
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
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
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

  const currentChapter = course?.chapters[currentChapterIndex];

  const completeCurrentChapter = useCallback(async (): Promise<boolean> => {
    if (!currentChapter || currentChapter.progress?.completed) return true;
    try {
      const res = await fetch(`/api/courses/${selectedCourseId}/chapters/${currentChapter.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const courseRes = await fetch(`/api/courses/${selectedCourseId}`);
        if (courseRes.ok) setCourse(await courseRes.json());
        return true;
      }
      return false;
    } catch { return false; }
  }, [currentChapter, selectedCourseId]);

  // ── Paywall redirect: will clicking "next" send user to offers? ──
  const isPaywallRedirect = useMemo(() => {
    if (isSubscribed) return false;
    if (!course) return false;
    const nextIdx = currentChapterIndex + 1;
    if (nextIdx >= course.chapters.length) return false;
    return nextIdx >= freeChapterLimit;
  }, [isSubscribed, course, currentChapterIndex, freeChapterLimit]);

  const goToNext = useCallback(async () => {
    if (!course || isCompleting) return;
    if (currentChapterIndex >= course.chapters.length - 1) return;

    // Free preview: block chapter 2+ for non-subscribers
    if (!isSubscribed && currentChapterIndex + 1 >= freeChapterLimit) {
      trackEvent({ name: "paywall_hit" });
      setView("offers");
      return;
    }

    if (isChapterLevelLocked(currentChapterIndex + 1)) return;

    setIsCompleting(true);
    const wasJustCompleted = !currentChapter?.progress?.completed;
    if (wasJustCompleted) {
      const success = await completeCurrentChapter();
      if (!success) { setIsCompleting(false); return; }
      const userName = user?.firstName || (lang === "fr" ? "Champion" : "Champion");
      setShowConfetti(true);
      setShowCelebration(true);
      setCelebrationMessage(lang === "fr" ? `Chapitre ${currentChapterIndex + 1} terminé ${userName} ! 🎉` : `Chapter ${currentChapterIndex + 1} done ${userName}! 🎉`);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = setTimeout(() => { setShowCelebration(false); setShowConfetti(false); }, 2000);
    }
    endStudySession();
    const nextIdx = currentChapterIndex + 1;
    setCurrentChapterIndex(nextIdx);
    startStudySession(course.id, course.chapters[nextIdx]?.id);
    setIsCompleting(false);
  }, [course, isCompleting, currentChapter?.progress?.completed, currentChapterIndex, completeCurrentChapter, user?.firstName, lang, endStudySession, startStudySession, setCurrentChapterIndex, isSubscribed, freeChapterLimit, setView]);

  const goToPrev = useCallback(() => {
    if (currentChapterIndex === 0 || !course) return;
    endStudySession();
    const prevIdx = currentChapterIndex - 1;
    setCurrentChapterIndex(prevIdx);
    startStudySession(course.id, course.chapters[prevIdx]?.id);
  }, [currentChapterIndex, course, endStudySession, startStudySession, setCurrentChapterIndex]);

  // ── Level Complete handler ──
  const handleFinalQuizComplete = useCallback((passed: boolean) => {
    if (!passed) return;
    const userName = user?.firstName || (lang === "fr" ? "Champion" : "Champion");
    setShowConfetti(true);
    setShowCelebration(true);
    setCelebrationMessage(lang === "fr" ? `Félicitations ${userName} ! 🏆` : `Congratulations ${userName}! 🏆`);
    setCourseCompleted(true);
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
      const data = await res.json();
      if (res.ok && data.chapters?.length > 0) {
        // Refetch course
        await fetchCourse();
        // Navigate to first chapter of new level
        const firstNewChapterIdx = course.chapters.findIndex((ch) => (ch.level ?? 0) === nextLevel);
        if (firstNewChapterIdx >= 0) setCurrentChapterIndex(firstNewChapterIdx);
      }
    } catch {
      // show error
    } finally {
      setIsGeneratingLevel(false);
    }
  }, [course, selectedCourseId, maxUnlockedLevel, fetchCourse, setCurrentChapterIndex]);

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

  // ── Level names helper ──
  const getLevelName = (level: number) => lang === "fr" ? LEVEL_NAMES_FR[level] : LEVEL_NAMES_EN[level];

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
  if (!selectedCourseId || fetchError || (!loading && !course)) {
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
                {lang === "fr" ? "+50 🔥" : "+50 🔥"}
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
            <div className="flex flex-col gap-3">
              <button
                onClick={handleContinueToNextLevel}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gradient-to-r from-gold to-gold-dark text-night font-bold text-sm hover:from-gold-light hover:to-gold transition-all cursor-pointer shadow-lg shadow-gold/20"
              >
                <Rocket className="w-5 h-5" />
                {tx.levelReview.nextLevel}
              </button>
              <button
                onClick={handleStopHere}
                className="w-full px-6 py-3 rounded-full glass text-muted-foreground font-bold text-sm hover:bg-white/10 hover:text-foreground transition-all cursor-pointer"
              >
                {tx.levelReview.stopHere}
              </button>
            </div>
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
              <button onClick={goToNext} disabled={currentChapterIndex === course.chapters.length - 1 || isCompleting} className="p-2 rounded-xl hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer"><ChevronRight className="w-5 h-5" /></button>
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
                  <p className="text-lg text-foreground/80 leading-relaxed">{currentChapter.summary}</p>
                </div>
              )}
              <div className="prose prose-invert max-w-none text-[18px] leading-8 animate-fade-in-slide-right prose-p:text-[1.175rem] prose-p:leading-[2] prose-p:mb-6 prose-h2:text-[1.6rem] prose-h2:mt-12 prose-h2:mb-6 prose-h3:text-[1.4rem] prose-h3:mt-10 prose-h3:mb-5 prose-li:text-[1.175rem] prose-li:my-2 prose-li:leading-[2] prose-ul:my-6 prose-ol:my-6 prose-strong:text-gold prose-hr:border-gold/20 prose-hr:my-12">
                <ReactMarkdown>{currentChapter.content}</ReactMarkdown>
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
            <div key={`chapter-${currentChapter.id}`} className="max-w-3xl mx-auto px-4 sm:px-5 md:px-6 py-5 sm:py-6 md:py-8 animate-fade-in-slide-right">
              <div className="md:hidden flex justify-end mb-4">
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

              <div className="prose prose-invert max-w-none text-[15px] sm:text-[18px] leading-8
                prose-headings:font-extrabold
                prose-h1:text-3xl sm:text-4xl prose-h1:mt-10 sm:mt-14 prose-h1:mb-4 sm:mb-6
                prose-h2:text-[1.25rem] sm:text-[1.6rem] prose-h2:mt-8 sm:mt-12 prose-h2:mb-4 sm:mb-6
                prose-h3:text-[1.15rem] sm:text-[1.4rem] prose-h3:mt-6 sm:mt-10 prose-h3:mb-3 sm:mb-5
                prose-p:text-[0.98rem] sm:text-[1.175rem] prose-p:leading-[1.8] sm:leading-[2] prose-p:text-foreground/90 prose-p:mb-4 sm:mb-5
                prose-li:text-[0.98rem] sm:text-[1.175rem] prose-li:text-foreground/90 prose-li:leading-[1.8] sm:leading-[2] prose-li:my-1 sm:my-2
                prose-ul:my-4 sm:my-6 prose-ol:my-4 sm:my-6
                prose-strong:text-gold
                prose-code:text-gold-light prose-code:bg-mauve/10 prose-code:px-2 prose-code:py-1 prose-code:rounded-lg prose-code:text-[0.85rem] sm:text-[0.95rem]
                prose-pre:bg-night prose-pre:border prose-pre:border-border prose-pre:rounded-2xl prose-pre:py-4 sm:py-6 prose-pre:text-[0.85rem] sm:text-[0.95rem]
                prose-a:text-mauve-light
                prose-blockquote:text-amber-300 prose-blockquote:border-gold/30 prose-blockquote:my-6 sm:my-8
                prose-hr:border-gold/20 prose-hr:my-8 sm:my-12
              ">
                <ReactMarkdown>{currentChapter.content}</ReactMarkdown>
              </div>

              {/* Navigation footer */}
              <div className="flex items-center justify-between mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border">
                <button onClick={goToPrev} disabled={currentChapterIndex === 0 || isCompleting} className="flex items-center gap-2 px-4 md:px-6 py-3 rounded-full glass text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{tx.viewer.previous}</span>
                </button>
                {currentChapterIndex < course.chapters.length - 1 ? (
                  <button onClick={goToNext} disabled={isCompleting} className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-sm font-bold hover:from-mauve-light hover:to-mauve transition-all disabled:opacity-50 cursor-pointer">
                    {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{tx.viewer.next}<ChevronRight className="w-4 h-4" /></>}
                  </button>
                ) : allChaptersCompleted ? (
                  <button onClick={() => setShowFinalQuiz(true)} className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-gold to-gold-dark text-night text-sm font-bold hover:from-gold-light hover:to-gold transition-all cursor-pointer">
                    <Trophy className="w-4 h-4" />
                    {tx.viewer.finalQuiz}
                  </button>
                ) : (
                  <button onClick={goToNext} disabled={isCompleting} className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-sm font-bold hover:from-mauve-light hover:to-mauve transition-all disabled:opacity-50 cursor-pointer">
                    {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{lang === "fr" ? "Terminer le cours" : "Complete course"}<CheckCircle2 className="w-4 h-4" /></>}
                  </button>
                )}
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
    </>
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
      const url = `/api/courses/${courseId}/final-quiz`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
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
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="p-5 rounded-2xl glass">
          <p className="font-bold text-sm mb-4">
            <span className="text-mauve-light">{qIdx + 1}.</span> {q.question}
          </p>
          <div className="space-y-2">
            {q.options.map((opt, oIdx) => {
              const isSelected = answers[qIdx] === oIdx;
              const isCorrect = result === null ? false : false; // Don't show until submitted
              return (
                <button
                  key={oIdx}
                  onClick={() => { if (result === null) setAnswers({ ...answers, [qIdx]: oIdx }); }}
                  disabled={result !== null}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer ${
                    isSelected ? "bg-mauve/20 border border-mauve/40 text-mauve-light font-semibold"
                      : "border border-border hover:bg-white/5 text-muted-foreground"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
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
