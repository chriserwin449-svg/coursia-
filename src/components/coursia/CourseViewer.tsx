"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAppStore, type CourseData, type CourseChapter, type QuizQuestion } from "@/lib/store";
import { t } from "@/lib/i18n";
import Confetti from "@/components/coursia/Confetti";

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
  const showLevelUp = useAppStore((s) => s.showLevelUp);
  const setShowLevelUp = useAppStore((s) => s.setShowLevelUp);
  const levelUpData = useAppStore((s) => s.levelUpData);
  const setLevelUpData = useAppStore((s) => s.setLevelUpData);
  const setRandomTopic = useAppStore((s) => s.setRandomTopic);
  const setRandomCourseLang = useAppStore((s) => s.setRandomCourseLang);

  const chapterListRef = useRef<HTMLDivElement>(null);

  // ── Expanded chapters state for sub-chapter display ──
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());

  const toggleChapterExpanded = (idx: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // ── Parse sub-chapters from markdown content ──
  const parseSubChapters = useCallback((content: string): string[] => {
    return content.match(/^## (.+)$/gm)?.map((s) => s.replace(/^## /, '')) || [];
  }, []);

  // Memoize sub-chapter data per chapter to avoid re-parsing
  const chapterSubChapters = useMemo(() => {
    if (!course) return {} as Record<string, string[]>;
    const map: Record<string, string[]> = {};
    for (const ch of course.chapters) {
      map[ch.id] = parseSubChapters(ch.content || '');
    }
    return map;
  }, [course, parseSubChapters]);

  // ── Compute completed count and overall progress from course data ──
  const completedCount = useMemo(() => {
    if (!course) return 0;
    return course.chapters.filter((ch) => ch.progress?.completed).length;
  }, [course]);

  const totalChapters = course?.chapters.length ?? 0;
  const overallProgress = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;
  const allChaptersCompleted = totalChapters > 0 && completedCount === totalChapters;

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

  // End session on unmount or view change
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

  // End session when user closes browser tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (studySessionId) {
        navigator.sendBeacon(
          "/api/study-time",
          new Blob([JSON.stringify({ action: "end", sessionId: studySessionId })], { type: "application/json" })
        );
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
      const res = await fetch(`/api/courses/${selectedCourseId}`);
      const data = await res.json();
      if (res.ok && data.chapters?.length > 0) {
        setCourse(data);
        // Check if course was already completed
        if (data.courseCompleted) {
          setCourseCompleted(true);
        }
        // Restore last viewed chapter or find first incomplete
        const savedChapterKey = `coursia-last-chapter-${selectedCourseId}`;
        const savedChapter = typeof window !== "undefined"
          ? localStorage.getItem(savedChapterKey)
          : null;
        let restoreIdx = 0;
        if (savedChapter) {
          const savedIdx = parseInt(savedChapter, 10);
          if (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < data.chapters.length) {
            const isUnlocked = savedIdx === 0 || data.chapters[savedIdx - 1]?.progress?.completed;
            if (isUnlocked) restoreIdx = savedIdx;
          }
        }
        if (restoreIdx === 0) {
          const firstIncomplete = data.chapters.findIndex(
            (ch: CourseChapter) => !ch.progress?.completed
          );
          if (firstIncomplete >= 0) restoreIdx = firstIncomplete;
        }
        // Only restore if we haven't already set a chapter index
        const currentIdx = useAppStore.getState().currentChapterIndex;
        if (currentIdx === 0 || currentIdx >= data.chapters.length) {
          setCurrentChapterIndex(restoreIdx);
        }
        // Start study session for this course
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

  useEffect(() => {
    fetchCourse();
  }, [selectedCourseId]);

  // Scroll active chapter into view in the chapter list
  useEffect(() => {
    if (!chapterListRef.current) return;
    const activeEl = chapterListRef.current.querySelector(`[data-chapter-idx="${currentChapterIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentChapterIndex]);

  // Auto-expand the active chapter when it has sub-chapters
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

  // Save current chapter position to localStorage
  useEffect(() => {
    if (!selectedCourseId || !course) return;
    const key = `coursia-last-chapter-${selectedCourseId}`;
    localStorage.setItem(key, String(currentChapterIndex));
  }, [currentChapterIndex, selectedCourseId, course]);

  const currentChapter = course?.chapters[currentChapterIndex];

  // ── Complete current chapter via API (no quiz) ──
  const completeCurrentChapter = useCallback(async (): Promise<boolean> => {
    if (!currentChapter) return false;
    // Already completed
    if (currentChapter.progress?.completed) return true;

    try {
      const res = await fetch(`/api/courses/${selectedCourseId}/chapters/${currentChapter.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        // Refetch course to get updated progress
        const courseRes = await fetch(`/api/courses/${selectedCourseId}`);
        if (courseRes.ok) {
          const data = await courseRes.json();
          setCourse(data);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [currentChapter, selectedCourseId]);

  // ── Navigation: go to next chapter (auto-complete current) ──
  const goToNext = async () => {
    if (!course || isCompleting) return;

    // If on last chapter, do nothing (show final quiz instead)
    if (currentChapterIndex >= course.chapters.length - 1) return;

    setIsCompleting(true);

    // Auto-complete current chapter if not already completed
    const wasJustCompleted = !currentChapter?.progress?.completed;
    if (wasJustCompleted) {
      const success = await completeCurrentChapter();
      if (!success) {
        setIsCompleting(false);
        return;
      }
      // Show celebration for completing a chapter
      const userName = user?.firstName || (lang === "fr" ? "Champion" : "Champion");
      const completedAfter = completedCount + 1;
      setShowConfetti(true);
      setShowCelebration(true);
      setCelebrationMessage(
        lang === "fr"
          ? `Chapitre ${currentChapterIndex + 1} terminé ${userName} ! 🎉`
          : `Chapter ${currentChapterIndex + 1} done ${userName}! 🎉`
      );
      setTimeout(() => {
        setShowCelebration(false);
        setShowConfetti(false);
      }, 2000);
    }

    // Move to next chapter
    endStudySession();
    const nextIdx = currentChapterIndex + 1;
    setCurrentChapterIndex(nextIdx);
    startStudySession(course.id, course.chapters[nextIdx]?.id);
    setIsCompleting(false);
  };

  const goToPrev = () => {
    if (currentChapterIndex === 0 || !course) return;
    endStudySession();
    const prevIdx = currentChapterIndex - 1;
    setCurrentChapterIndex(prevIdx);
    startStudySession(course.id, course.chapters[prevIdx]?.id);
  };

  const isChapterUnlocked = (index: number) => {
    if (!course) return false;
    if (index === 0) return true;
    return course.chapters[index - 1].progress?.completed === true;
  };

  const handleFinalQuizComplete = (passed: boolean) => {
    if (passed) {
      const userName = user?.firstName || (lang === "fr" ? "Champion" : "Champion");
      setShowConfetti(true);
      setShowCelebration(true);
      setCelebrationMessage(lang === "fr" ? `Félicitations ${userName} ! 🏆` : `Congratulations ${userName}! 🏆`);
      setCourseCompleted(true);
      setTimeout(() => {
        setShowCelebration(false);
        setShowFinalQuiz(false);
        setShowConfetti(false);
        endStudySession();

        // Check if we should show level-up modal
        const courseLevel = course?.level ?? 0;
        const courseTitle = course?.title ?? "";
        if (courseLevel < 2) {
          setShowLevelUp(true);
          setLevelUpData({
            title: courseTitle,
            currentLevel: courseLevel,
            nextLevel: courseLevel + 1,
          });
        } else if (courseLevel === 2) {
          setShowLevelUp(true);
          setLevelUpData({
            title: courseTitle,
            currentLevel: 2,
            nextLevel: -1,
          });
        } else {
          if (course) setCurrentChapterIndex(0);
        }

        fetchCourse();
      }, 4000);
    }
  };

  const handleAdvanceLevel = () => {
    if (!levelUpData) return;
    setShowLevelUp(false);
    setLevelUpData(null);
    setRandomTopic(levelUpData.title);
    setRandomCourseLang(lang);
    setView("create");
  };

  const handleSkipLevel = () => {
    setShowLevelUp(false);
    setLevelUpData(null);
    if (course) setCurrentChapterIndex(0);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isFullscreen) {
        if (e.key === "ArrowRight" || e.key === " ") {
          e.preventDefault();
          goToNext();
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goToPrev();
        }
        if (e.key === "Escape") {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen, currentChapterIndex, goToNext, goToPrev, setIsFullscreen]);

  // Loading / error state
  if (!selectedCourseId || fetchError || (!loading && !course)) {
    return (
      <div className="flex items-center justify-center min-h-screen animate-fade-in">
        <div className="text-center">
          <div className="text-5xl mb-4 opacity-40">📚</div>
          <p className="text-muted-foreground text-lg mb-6">{tx.viewer.back}</p>
          <button
            onClick={() => setView("landing")}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer"
          >
            {tx.viewer.back}
          </button>
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
  // COURSE COMPLETED OVERVIEW — all chapters unlocked, green checks
  // ══════════════════════════════════════════════════════════════════
  if (courseCompleted && !showFinalQuiz && !showCelebration && !showLevelUp) {
    return (
      <>
        <Confetti active={false} />
        <div className="flex flex-col h-screen overflow-hidden">
          {/* Header */}
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

          {/* Chapters grid - all unlocked, all green */}
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
                    <button
                      key={ch.id}
                      onClick={() => {
                        setCurrentChapterIndex(idx);
                        setCourseCompleted(false);
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer group ${
                        isActive
                          ? "bg-mauve/15 border-2 border-mauve/30"
                          : "glass hover:bg-white/5"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{ch.title}</p>
                        <p className="text-xs text-muted-foreground">{tx.viewer.chapterOf(idx + 1, course.chapters.length)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                          {tx.viewer.completed}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Back to library button */}
              <div className="text-center mt-8">
                <button
                  onClick={() => setView("library")}
                  className="px-8 py-3 rounded-full glass font-bold text-sm hover:bg-white/10 transition-all cursor-pointer"
                >
                  {tx.viewer.back}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // FINAL QUIZ MODE — full screen mandatory quiz
  // ══════════════════════════════════════════════════════════════════
  if (showFinalQuiz) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Final quiz header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-night-light flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-extrabold gradient-text">C</span>
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

        {/* Final quiz body */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Warning banner */}
            <div className="mb-8 p-4 rounded-2xl bg-gold/5 border border-gold/20 text-center">
              <p className="text-sm font-semibold text-gold">{tx.viewer.finalQuizRequiredDesc}</p>
            </div>
            <QuizPanel
              courseId={course.id}
              isFinalQuiz={true}
              onComplete={handleFinalQuizComplete}
              onBack={() => { /* cannot go back from final quiz */ }}
            />
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
          {/* Fullscreen top bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
              <div>
                <p className="text-sm text-muted-foreground">{course.title}</p>
                <p className="font-bold gradient-text">
                  {tx.viewer.chapterOf(currentChapterIndex + 1, course.chapters.length)} : <span>{currentChapter.title}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full glass">
                <span className="text-sm font-semibold">
                  {completedCount} / {totalChapters}
                </span>
                <div className="w-32 h-2 rounded-full bg-night overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mauve to-gold transition-all duration-1000 ease-out"
                    style={{
                      width: `${overallProgress}%`,
                    }}
                  />
                </div>
              </div>
              <button onClick={goToPrev} disabled={currentChapterIndex === 0 || isCompleting} className="p-2 rounded-xl hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={goToNext} disabled={currentChapterIndex === course.chapters.length - 1 || isCompleting} className="p-2 rounded-xl hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Fullscreen content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-10">
              {/* Summary card */}
              {currentChapter.summary && (
                <div className="mb-8 p-5 rounded-2xl bg-mauve/5 border border-mauve/10 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-mauve-light" />
                    <span className="text-xs font-bold text-mauve-light uppercase tracking-wider">{tx.viewer.summary}</span>
                  </div>
                  <p className="text-lg text-foreground/80 leading-relaxed">{currentChapter.summary}</p>
                </div>
              )}
              {/* Content — LARGER text for fullscreen */}
              <div className="prose prose-invert max-w-none animate-fade-in-slide-right prose-p:text-[1.85rem] prose-p:leading-[2.3] prose-p:mb-7 prose-h2:text-[2.5rem] prose-h2:mt-16 prose-h2:mb-8 prose-h3:text-[2.1rem] prose-h3:mt-14 prose-h3:mb-6 prose-li:text-[1.85rem] prose-li:my-3 prose-li:leading-[2.1] prose-ul:my-8 prose-ol:my-8 prose-strong:text-gold prose-hr:border-gold/20 prose-hr:my-12">
                <ReactMarkdown>{currentChapter.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>

        {/* Celebration overlay */}
        {showCelebration && <Confetti active={true} />}
        {showCelebration && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-night/80 backdrop-blur-sm animate-fade-in">
            <div className="text-center p-12 rounded-3xl glass animate-celebrate relative">
              <div className="text-6xl mb-6">🎉</div>
              <h2 className="text-3xl font-extrabold gradient-text mb-4 animate-fade-in-slide-up">
                {useAppStore.getState().celebrationMessage}
              </h2>
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
      <div className="flex h-screen overflow-hidden">
        {/* ─── Sidebar: Chapter navigation ─── */}
        <div className="w-64 border-r border-border bg-night-light flex flex-col flex-shrink-0">
          {/* Course title + chapter counter + overall progress */}
          <div className="p-4 border-b border-border">
            <h2 className="font-bold text-sm leading-tight line-clamp-2 mb-3">{course.title}</h2>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold text-mauve-light">
                {completedCount}/{totalChapters} {lang === "fr" ? "chapitres" : "chapters"}
              </span>
              <span className="font-bold">{overallProgress}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-night overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-mauve to-gold transition-all duration-1000 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Scrollable chapter list */}
          <div ref={chapterListRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            {course.chapters.map((ch, idx) => {
              const isActive = idx === currentChapterIndex;
              const isUnlocked = isChapterUnlocked(idx);
              const isCompleted = ch.progress?.completed;
              const subChapters = chapterSubChapters[ch.id] || [];
              const hasSubChapters = subChapters.length > 0;
              const MAX_SUBCHAPTERS_SHOWN = 3;
              const visibleSubChapters = subChapters.slice(0, MAX_SUBCHAPTERS_SHOWN);
              const remainingCount = subChapters.length - MAX_SUBCHAPTERS_SHOWN;
              const isExpanded = expandedChapters.has(idx);

              return (
                <div key={ch.id} data-chapter-idx={idx}>
                  <button
                    onClick={() => {
                      if (isUnlocked) {
                        setCurrentChapterIndex(idx);
                        // Toggle sub-chapters on click if not already active
                        if (!isActive && hasSubChapters) {
                          setExpandedChapters((prev) => {
                            const next = new Set(prev);
                            next.add(idx);
                            return next;
                          });
                        }
                      }
                    }}
                    disabled={!isUnlocked}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-200 cursor-pointer group ${
                      isActive
                        ? "bg-mauve/15 border border-mauve/30 text-foreground shadow-sm"
                        : isCompleted
                          ? "hover:bg-white/5 text-foreground border border-transparent"
                          : isUnlocked
                            ? "hover:bg-white/5 text-muted-foreground hover:text-foreground border border-transparent"
                            : "opacity-40 text-muted-foreground cursor-not-allowed border border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* ── Icon column ── */}
                      <div className="flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center">
                        {isCompleted ? (
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
                        <p className={`text-xs font-semibold line-clamp-2 leading-snug ${isActive ? "text-mauve-light" : ""}`}>
                          {ch.title}
                        </p>
                        {isCompleted && (
                          <p className="text-[10px] text-green-400 mt-0.5">
                            {tx.viewer.completed}
                          </p>
                        )}
                      </div>

                      {/* ── Expand/collapse chevron for unlocked chapters with sub-chapters ── */}
                      {isUnlocked && hasSubChapters && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChapterExpanded(idx);
                          }}
                          className={`flex-shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center cursor-pointer transition-transform duration-300 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        >
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* ── Sub-chapters (only for unlocked, expanded chapters) ── */}
                  {isUnlocked && hasSubChapters && isExpanded && (
                    <div className="ml-7 mt-1 mb-1 animate-subchapter-expand">
                      {visibleSubChapters.map((sub, subIdx) => (
                        <div
                          key={subIdx}
                          className="flex items-center gap-2 py-0.5"
                        >
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                          <span className="text-[10px] leading-snug text-muted-foreground/70 line-clamp-1">
                            {sub}
                          </span>
                        </div>
                      ))}
                      {remainingCount > 0 && (
                        <div className="flex items-center gap-2 py-0.5">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/20 flex-shrink-0" />
                          <span className="text-[10px] text-muted-foreground/40 font-medium">
                            +{remainingCount} {lang === "fr" ? "autres" : "more"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Final quiz trigger (appears when all chapters done) */}
          {allChaptersCompleted && (
            <div className="p-3 border-t border-border">
              <button
                onClick={() => setShowFinalQuiz(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-night text-xs font-bold hover:from-gold-light hover:to-gold transition-all cursor-pointer shadow-lg shadow-gold/20"
              >
                <Trophy className="w-4 h-4" />
                {tx.viewer.finalQuiz}
              </button>
            </div>
          )}
        </div>

        {/* ─── Main content area ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold gradient-text">{currentChapter.title}</h2>
              <p className="text-sm text-muted-foreground font-semibold">
                {tx.viewer.chapterOf(currentChapterIndex + 1, totalChapters)}
                {!currentChapter.progress?.completed && (
                  <span className="ml-2 text-mauve-light">
                    — {lang === "fr" ? "En cours" : "In progress"}
                  </span>
                )}
                {currentChapter.progress?.completed && (
                  <span className="ml-2 text-green-400">
                    — {tx.viewer.completed} ✓
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full glass text-xs font-bold hover:bg-white/10 transition-all cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{tx.viewer.enlarge}</span>
              </button>
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div
              key={`chapter-${currentChapter.id}`}
              className="max-w-3xl mx-auto px-6 py-8 animate-fade-in-slide-right"
            >
              {/* ── Summary card ── */}
              {currentChapter.summary && (
                <div className="mb-8 p-5 rounded-2xl bg-mauve/5 border border-mauve/10">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-mauve-light" />
                    <span className="text-xs font-bold text-mauve-light uppercase tracking-wider">{tx.viewer.summary}</span>
                  </div>
                  <p className="text-lg text-foreground/80 leading-relaxed">{currentChapter.summary}</p>
                </div>
              )}

              {/* ── Course content (Markdown) — LARGER text ── */}
              <div className="prose prose-invert max-w-none
                prose-headings:font-extrabold
                prose-h1:text-4xl prose-h1:mt-14 prose-h1:mb-6
                prose-h2:text-[2.2rem] prose-h2:mt-14 prose-h2:mb-7
                prose-h3:text-[1.85rem] prose-h3:mt-12 prose-h3:mb-5
                prose-p:text-[1.55rem] prose-p:leading-[2.3] prose-p:text-foreground/90 prose-p:mb-7
                prose-li:text-[1.55rem] prose-li:text-foreground/90 prose-li:leading-[2.1] prose-li:my-3
                prose-ul:my-8 prose-ol:my-8
                prose-strong:text-gold
                prose-code:text-gold-light prose-code:bg-mauve/10 prose-code:px-2 prose-code:py-1 prose-code:rounded-lg prose-code:text-[1.2rem]
                prose-pre:bg-night prose-pre:border prose-pre:border-border prose-pre:rounded-2xl prose-pre:py-8 prose-pre:text-[1.2rem]
                prose-a:text-mauve-light
                prose-blockquote:text-amber-300 prose-blockquote:border-gold/30 prose-blockquote:my-8
                prose-hr:border-gold/20 prose-hr:my-12
              ">
                <ReactMarkdown>{currentChapter.content}</ReactMarkdown>
              </div>

              {/* ── Navigation footer ── */}
              <div className="flex items-center justify-between mt-12 pt-6 border-t border-border">
                <button
                  onClick={goToPrev}
                  disabled={currentChapterIndex === 0 || isCompleting}
                  className="flex items-center gap-2 px-6 py-3 rounded-full glass text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {tx.viewer.previous}
                </button>
                {currentChapterIndex < course.chapters.length - 1 ? (
                  <button
                    onClick={goToNext}
                    disabled={isCompleting}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-sm font-bold hover:from-mauve-light hover:to-mauve transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isCompleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {tx.viewer.next}
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                ) : allChaptersCompleted ? (
                  <button
                    onClick={() => setShowFinalQuiz(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-gold to-gold-dark text-night text-sm font-bold hover:from-gold-light hover:to-gold transition-all cursor-pointer"
                  >
                    <Trophy className="w-4 h-4" />
                    {tx.viewer.finalQuiz}
                  </button>
                ) : (
                  <button
                    onClick={goToNext}
                    disabled={isCompleting}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-sm font-bold hover:from-mauve-light hover:to-mauve transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isCompleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {lang === "fr" ? "Terminer le cours" : "Complete course"}
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
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
            <h2 className="text-3xl font-extrabold gradient-text mb-4 animate-fade-in-slide-up">
              {useAppStore.getState().celebrationMessage}
            </h2>
          </div>
        </div>
      )}

      {/* ═══ Level-Up Modal Overlay ═══ */}
      {showLevelUp && levelUpData && (
        <>
          <Confetti active={true} big />
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-night/90 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-md mx-4 p-8 rounded-3xl glass animate-celebrate">
              {/* Decorative particles */}
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-gold"
                  style={{
                    left: "50%", top: "50%", position: "absolute",
                    animation: `float-up 1.2s ease-out ${0.3 + i * 0.08}s forwards`,
                    opacity: 0,
                    transform: `translate(${(Math.random() - 0.5) * 350}px, ${(Math.random() - 0.5) * 350}px)`,
                  }}
                />
              ))}

              {levelUpData.nextLevel === -1 ? (
                /* ── All Levels Complete ── */
                <div className="text-center relative z-10">
                  <div className="text-7xl mb-5 animate-fade-in-slide-up">🏆</div>
                  <h2 className="text-2xl md:text-3xl font-extrabold gradient-text mb-3 animate-fade-in-slide-up">
                    {tx.viewer.levelUpAllDone}
                  </h2>
                  <p className="text-foreground font-bold text-lg mb-1 animate-fade-in-slide-up" style={{ animationDelay: "0.1s" }}>
                    {user?.firstName ? (lang === "fr" ? `Bravo ${user.firstName} !` : `Great job ${user.firstName}!`) : ""}
                  </p>
                  <p className="text-muted-foreground text-sm mb-2 animate-fade-in-slide-up" style={{ animationDelay: "0.15s" }}>
                    {levelUpData.title}
                  </p>
                  <p className="text-muted-foreground text-sm mb-6 animate-fade-in-slide-up" style={{ animationDelay: "0.25s" }}>
                    {tx.viewer.levelUpAllDoneDesc}
                  </p>
                  {/* Flame bonuses recap */}
                  <div className="space-y-2 mb-8 animate-fade-in-slide-up" style={{ animationDelay: "0.35s" }}>
                    <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/20">
                      <span className="font-bold text-gold">
                        {tx.viewer.levelUpFlameBonus.replace("{points}", "50")}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/20">
                      <span className="font-bold text-gold">
                        {tx.viewer.levelUpFlameBonus.replace("{points}", "50")}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="font-bold text-emerald-400">
                        {tx.viewer.levelUpFlameBonus.replace("{points}", "500")}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleSkipLevel}
                    className="px-8 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer animate-fade-in-slide-up"
                    style={{ animationDelay: "0.45s" }}
                  >
                    {tx.viewer.back}
                  </button>
                </div>
              ) : (
                /* ── Next Level Available ── */
                <div className="text-center relative z-10">
                  <div className="text-6xl mb-4 animate-fade-in-slide-up">🚀</div>
                  <h2 className="text-xl md:text-2xl font-extrabold gradient-text mb-2 animate-fade-in-slide-up">
                    {tx.viewer.levelUpTitle}
                  </h2>
                  <p className="text-foreground font-bold text-lg mb-1 animate-fade-in-slide-up" style={{ animationDelay: "0.05s" }}>
                    {user?.firstName ? (lang === "fr" ? `${user.firstName}, tu es incroyable !` : `${user.firstName}, you are amazing!`) : ""}
                  </p>
                  <p className="text-muted-foreground text-sm mb-1 animate-fade-in-slide-up" style={{ animationDelay: "0.1s" }}>
                    {levelUpData.title}
                  </p>
                  <p className="text-muted-foreground text-sm mb-6 animate-fade-in-slide-up" style={{ animationDelay: "0.15s" }}>
                    {tx.viewer.levelUpDesc}{' '}
                    <span className="text-gold font-bold">{tx.create.levels[levelUpData.currentLevel]}</span>
                    {' → '}
                    <span className="text-emerald-400 font-bold">{tx.create.levels[levelUpData.nextLevel]}</span>
                  </p>

                  {/* Flame points earned */}
                  <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 rounded-xl bg-gold/10 border border-gold/20 animate-fade-in-slide-up" style={{ animationDelay: "0.2s" }}>
                    <span className="font-bold text-gold">
                      {tx.viewer.levelUpFlameLevel.replace("{points}", "50")}
                    </span>
                  </div>

                  {/* AI Recap info */}
                  <div className="p-4 rounded-2xl bg-mauve/5 border border-mauve/10 text-left mb-6 animate-fade-in-slide-up" style={{ animationDelay: "0.3s" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">🤖</span>
                      <span className="text-xs font-bold text-mauve-light uppercase tracking-wider">{tx.viewer.levelUpRecap}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{tx.viewer.levelUpRecapDesc}</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-3 animate-fade-in-slide-up" style={{ animationDelay: "0.4s" }}>
                    <button
                      onClick={handleAdvanceLevel}
                      className="w-full px-6 py-3.5 rounded-full bg-gradient-to-r from-gold to-gold-dark text-night font-bold text-sm hover:from-gold-light hover:to-gold transition-all cursor-pointer shadow-lg shadow-gold/20"
                    >
                      {tx.viewer.levelUpBtn}
                    </button>
                    <button
                      onClick={handleSkipLevel}
                      className="w-full px-6 py-3 rounded-full glass text-muted-foreground font-bold text-sm hover:bg-white/10 hover:text-foreground transition-all cursor-pointer"
                    >
                      {tx.viewer.levelUpSkip}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
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
  const [result, setResult] = useState<{
    score: number;
    correct: number;
    total: number;
    passed: boolean;
  } | null>(null);

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
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
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
        body: JSON.stringify({
          answers: questions.map((_, i) => answers[i] ?? -1),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setTimeout(() => onComplete(data.passed), 2500);
      }
    } catch {
      // fail silently
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-mauve" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="text-center py-10 animate-fade-in">
        <div className="animate-celebrate inline-block">
          <div className="text-6xl mb-4">{result.passed ? "🎉" : "💪"}</div>
          <h3 className="text-2xl font-extrabold mb-2">
            {result.passed
              ? tx.viewer.finalPassed
              : tx.viewer.almost}
          </h3>
          <p className="text-lg text-muted-foreground mb-4">
            {tx.viewer.score} : <span className="font-bold text-foreground">{result.score}%</span>{" "}
            ({result.correct}/{result.total})
          </p>
          {!result.passed && (
            <>
              <p className="text-muted-foreground mb-6">
                {tx.viewer.finalQuizRequiredDesc}
              </p>
              <button
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
                className="px-8 py-3 rounded-full bg-gradient-to-r from-gold to-gold-dark text-night font-bold cursor-pointer"
              >
                {tx.viewer.retry}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const allAnswered = questions.every((_, i) => answers[i] !== undefined);

  return (
    <div className="animate-fade-in">
      {/* Quiz header */}
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold">
          {tx.viewer.finalQuiz}
        </h3>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((q, qi) => (
          <div
            key={qi}
            className="glass rounded-2xl p-6 animate-fade-in-slide-up"
            style={{ animationDelay: `${qi * 0.05}s`, animationFillMode: "both" }}
          >
            <p className="text-lg font-bold mb-4">
              <span className="text-mauve-light">Q{qi + 1}.</span> {q.question}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => setAnswers({ ...answers, [qi]: oi })}
                  className={`p-4 rounded-2xl text-left text-base font-semibold transition-all cursor-pointer ${
                    answers[qi] === oi
                      ? "bg-mauve/20 border-2 border-mauve text-foreground"
                      : "bg-night border-2 border-transparent hover:border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="text-mauve-light mr-2 font-bold">
                    {String.fromCharCode(65 + oi)}.
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="mt-8 text-center">
        <button
          onClick={submitQuiz}
          disabled={!allAnswered || submitting}
          className="px-10 py-4 rounded-full text-night text-lg font-bold bg-gradient-to-r from-gold to-gold-dark hover:from-gold-light hover:to-gold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {tx.viewer.correcting}
            </span>
          ) : (
            tx.viewer.submit
          )}
        </button>
        {!allAnswered && (
          <p className="text-sm text-muted-foreground mt-3">
            {tx.viewer.answerAll}
          </p>
        )}
      </div>
    </div>
  );
}
