"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Lock,
  HelpCircle,
  Loader2,
  BookOpen,
  Trophy,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAppStore, type CourseData, type CourseChapter, type QuizQuestion } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function CourseViewer() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);

  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);

  const selectedCourseId = useAppStore((s) => s.selectedCourseId);
  const currentChapterIndex = useAppStore((s) => s.currentChapterIndex);
  const setCurrentChapterIndex = useAppStore((s) => s.setCurrentChapterIndex);
  const isFullscreen = useAppStore((s) => s.isFullscreen);
  const setIsFullscreen = useAppStore((s) => s.setIsFullscreen);
  const showQuiz = useAppStore((s) => s.showQuiz);
  const setShowQuiz = useAppStore((s) => s.setShowQuiz);
  const setView = useAppStore((s) => s.setView);
  const showCelebration = useAppStore((s) => s.showCelebration);
  const setShowCelebration = useAppStore((s) => s.setShowCelebration);
  const setCelebrationMessage = useAppStore((s) => s.setCelebrationMessage);

  const fetchCourse = useCallback(async () => {
    if (!selectedCourseId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${selectedCourseId}`);
      const data = await res.json();
      if (res.ok) {
        setCourse(data);
        const firstIncomplete = data.chapters.findIndex(
          (ch: CourseChapter) => !ch.progress?.completed
        );
        if (firstIncomplete >= 0 && currentChapterIndex === 0) {
          setCurrentChapterIndex(firstIncomplete);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId, currentChapterIndex, setCurrentChapterIndex]);

  useEffect(() => {
    fetchCourse();
  }, [selectedCourseId]);

  const currentChapter = course?.chapters[currentChapterIndex];

  const goToNext = () => {
    if (!course) return;
    if (currentChapterIndex < course.chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  };

  const goToPrev = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  };

  const isChapterUnlocked = (index: number) => {
    if (!course) return false;
    if (index === 0) return true;
    return course.chapters[index - 1].progress?.completed === true;
  };

  const handleQuizComplete = (passed: boolean) => {
    if (passed) {
      if (course && currentChapterIndex === course.chapters.length - 1) {
        setShowCelebration(true);
        setCelebrationMessage(tx.viewer.courseDone);
        setTimeout(() => {
          setShowCelebration(false);
          setView("library");
        }, 3000);
      } else {
        setShowCelebration(true);
        setCelebrationMessage(tx.viewer.chapterDone);
        setTimeout(() => {
          setShowCelebration(false);
          setShowQuiz(false);
          if (currentChapterIndex < (course?.chapters.length || 0) - 1) {
            setCurrentChapterIndex(currentChapterIndex + 1);
          }
          fetchCourse();
        }, 2000);
      }
    } else {
      setShowQuiz(false);
    }
  };

  // Auto-advance logic
  useEffect(() => {
    if (autoAdvance && autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
    }
    if (autoAdvance) {
      autoAdvanceRef.current = setTimeout(() => {
        goToNext();
      }, 5000);
    }
    return () => {
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
      }
    };
  }, [autoAdvance, currentChapterIndex, goToNext]);

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

  // Loading state
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

  return (
    <>
      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-night flex flex-col animate-fade-in">
          {/* Fullscreen top bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
              <div>
                <p className="text-sm text-muted-foreground">{course.title}</p>
                <p className="font-bold">
                  {tx.viewer.chapterOf(currentChapterIndex + 1, course.chapters.length)} : {currentChapter.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full glass">
                <span className="text-sm font-semibold">
                  {currentChapterIndex + 1} / {course.chapters.length}
                </span>
                <div className="w-32 h-2 rounded-full bg-night overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mauve to-gold transition-all duration-1000 ease-out"
                    style={{
                      width: `${((currentChapterIndex + 1) / course.chapters.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <button
                onClick={goToPrev}
                disabled={currentChapterIndex === 0}
                className="p-2 rounded-xl hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToNext}
                disabled={currentChapterIndex === course.chapters.length - 1}
                className="p-2 rounded-xl hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Fullscreen content */}
          <div className="flex-1 overflow-y-auto px-8 py-10">
            <div className="fullscreen-content prose prose-invert max-w-none animate-fade-in-slide-right">
              <ReactMarkdown>{currentChapter.content}</ReactMarkdown>
            </div>
          </div>

          {/* Fullscreen bottom */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              {tx.viewer.navHint}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoAdvance(!autoAdvance)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                  autoAdvance
                    ? "bg-gold/20 text-gold border border-gold/30"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
              >
                {tx.viewer.autoAdvance}
              </button>
              {currentChapter.progress?.completed && (
                <span className="flex items-center gap-1 px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  {tx.viewer.completed}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Normal view */}
      <div className="flex h-screen">
        {/* Chapter sidebar */}
        <div className="w-72 border-r border-border bg-night-light flex flex-col flex-shrink-0">
          {/* Back button & title */}
          <div className="p-4 border-b border-border">
            <button
              onClick={() => setView("library")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all mb-3 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-semibold">{tx.viewer.back}</span>
            </button>
            <h2 className="font-bold text-lg leading-tight line-clamp-2">{course.title}</h2>
            {/* Overall progress */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{tx.viewer.progress}</span>
                <span className="font-bold">{course.overallProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-night overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-mauve to-gold transition-all duration-1000 ease-out"
                  style={{ width: `${course.overallProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Chapter list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {course.chapters.map((ch, idx) => {
              const isActive = idx === currentChapterIndex;
              const isUnlocked = isChapterUnlocked(idx);
              const isCompleted = ch.progress?.completed;

              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    if (isUnlocked) {
                      setCurrentChapterIndex(idx);
                      setShowQuiz(false);
                    }
                  }}
                  disabled={!isUnlocked}
                  className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-mauve/20 border border-mauve/30 text-foreground"
                      : isCompleted
                        ? "hover:bg-white/5 text-foreground"
                        : isUnlocked
                          ? "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                          : "opacity-40 text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : !isUnlocked ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <BookOpen className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold line-clamp-2">
                        {tx.viewer.chapterOf(ch.order, course.chapters.length)} — {ch.title}
                      </p>
                      {isCompleted && (
                        <p className="text-xs text-green-400 mt-0.5">
                          {tx.viewer.score} : {ch.progress?.score}%
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Course complete */}
          {course.overallProgress === 100 && (
            <div className="p-4 border-t border-border">
              <div className="p-3 rounded-2xl bg-gold/10 border border-gold/20 text-center">
                <Trophy className="w-6 h-6 text-gold mx-auto mb-1" />
                <p className="text-sm font-bold text-gold">{tx.viewer.courseComplete}</p>
              </div>
            </div>
          )}
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">{currentChapter.title}</h2>
              <p className="text-sm text-muted-foreground">
                {tx.viewer.chapterOf(currentChapter.order, course.chapters.length)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {currentChapter.progress?.completed ? (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-bold hover:bg-green-500/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {tx.viewer.completed} ✓
                </button>
              ) : (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gold/10 text-gold border border-gold/20 text-sm font-bold hover:bg-gold/20 transition-all cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4" />
                  {tx.viewer.quiz}
                </button>
              )}
              <button
                onClick={() => setIsFullscreen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full glass text-sm font-bold hover:bg-white/10 transition-all cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden md:inline">{tx.viewer.enlarge}</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {!showQuiz ? (
              <div
                key={`chapter-${currentChapter.id}`}
                className="max-w-3xl mx-auto px-6 py-8 animate-fade-in-slide-right"
              >
                <div className="prose prose-invert max-w-none
                  prose-headings:font-extrabold prose-headings:text-foreground
                  prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                  prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                  prose-p:text-lg prose-p:leading-relaxed prose-p:text-foreground/90
                  prose-li:text-lg prose-li:text-foreground/90
                  prose-strong:text-foreground
                  prose-code:text-gold-light prose-code:bg-mauve/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-lg
                  prose-pre:bg-night prose-pre:border prose-pre:border-border prose-pre:rounded-2xl prose-pre:py-6
                  prose-a:text-mauve-light
                ">
                  <ReactMarkdown>{currentChapter.content}</ReactMarkdown>
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center justify-between mt-12 pt-6 border-t border-border">
                  <button
                    onClick={goToPrev}
                    disabled={currentChapterIndex === 0}
                    className="flex items-center gap-2 px-6 py-3 rounded-full glass text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {tx.viewer.previous}
                  </button>
                  <button
                    onClick={() => setShowQuiz(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-sm font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer"
                  >
                    {currentChapter.progress?.completed
                      ? tx.viewer.redoQuiz
                      : tx.viewer.quiz}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                key="quiz"
                className="max-w-3xl mx-auto px-6 py-8 animate-fade-in-slide-right"
              >
                <QuizPanel
                  chapterId={currentChapter.id}
                  courseId={course.id}
                  onComplete={handleQuizComplete}
                  onBack={() => setShowQuiz(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Celebration overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 backdrop-blur-sm animate-fade-in">
          <div className="text-center p-12 rounded-3xl glass animate-celebrate relative">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-3xl font-extrabold gradient-text mb-4 animate-fade-in-slide-up">
              {useAppStore.getState().celebrationMessage}
            </h2>
            {/* Sparkle particles */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-gold"
                style={{
                  left: "50%",
                  top: "50%",
                  position: "absolute",
                  animation: `float-up 1s ease-out ${0.5 + i * 0.1}s forwards`,
                  opacity: 0,
                  transform: `translate(${(Math.random() - 0.5) * 300}px, ${(Math.random() - 0.5) * 300}px)`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Inline Quiz Panel component
function QuizPanel({
  chapterId,
  courseId,
  onComplete,
  onBack,
}: {
  chapterId: string;
  courseId: string;
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
  const setShowQuiz = useAppStore((s) => s.setShowQuiz);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await fetch(
          `/api/courses/${courseId}/chapters/${chapterId}/quiz`,
          { method: "POST" }
        );
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
  }, [chapterId, courseId]);

  const submitQuiz = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/chapters/${chapterId}/quiz`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: questions.map((_, i) => answers[i] ?? -1),
          }),
        }
      );
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
            {result.passed ? tx.viewer.bravo : tx.viewer.almost}
          </h3>
          <p className="text-lg text-muted-foreground mb-4">
            {tx.viewer.score} : <span className="font-bold text-foreground">{result.score}%</span>{" "}
            ({result.correct}/{result.total})
          </p>
          {!result.passed && (
            <p className="text-muted-foreground mb-6">
              {tx.viewer.retryDesc}
            </p>
          )}
          {!result.passed && (
            <button
              onClick={() => {
                setResult(null);
                setAnswers({});
                setShowQuiz(false);
              }}
              className="px-8 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold cursor-pointer"
            >
              {tx.viewer.retry}
            </button>
          )}
        </div>
      </div>
    );
  }

  const allAnswered = questions.every((_, i) => answers[i] !== undefined);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-semibold">{tx.viewer.backToCourse}</span>
        </button>
        <h3 className="text-xl font-bold">{tx.viewer.quizTitle}</h3>
      </div>

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
          className="px-10 py-4 rounded-full bg-gradient-to-r from-gold to-gold-dark text-night text-lg font-bold hover:from-gold-light hover:to-gold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
