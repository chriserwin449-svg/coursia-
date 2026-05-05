"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sparkles,
  Plus,
  X,
  Link as LinkIcon,
  Loader2,
  BookOpen,
  ChevronRight,
  Signal,
  Globe,
  Flame,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import type { CourseData } from "@/lib/store";

export default function CreateCourse() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);

  const setView = useAppStore((s) => s.setView);
  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);
  const setIsGenerating = useAppStore((s) => s.setIsGenerating);

  const [title, setTitle] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [level, setLevel] = useState(1); // 0=Beginner, 1=Intermediate, 2=Advanced
  const [courseLang, setCourseLang] = useState("fr"); // "fr" or "en"
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [showSuggested, setShowSuggested] = useState(false);
  const [suggestedTopic, setSuggestedTopic] = useState("");
  const [flamePoints, setFlamePoints] = useState<number | null>(null);

  // Fetch flame points
  useEffect(() => {
    const fetchFlames = async () => {
      try {
        const res = await fetch("/api/flames");
        if (res.ok) {
          const data = await res.json();
          setFlamePoints(data.flamePoints);
        }
      } catch { /* ignore */ }
    };
    fetchFlames();
  }, []);

  const canAffordCourse = flamePoints !== null && flamePoints >= 100;
  const flameCost = 100;

  // ─── Store refs for random topic ────────────────────────────────────────
  const storeRandomTopic = useAppStore((s) => s.randomTopic);
  const storeRandomCourseLang = useAppStore((s) => s.randomCourseLang);
  const setStoreRandomTopic = useAppStore((s) => s.setRandomTopic);
  const prevRandomRef = useRef<string | null>(null);

  // ─── React to random topic changes from TopBar (instant, no reload) ───
  useEffect(() => {
    if (storeRandomTopic && storeRandomTopic !== prevRandomRef.current) {
      setTitle(storeRandomTopic);
      setSuggestedTopic(storeRandomTopic);
      setShowSuggested(true);
      if (storeRandomCourseLang === "fr" || storeRandomCourseLang === "en") {
        setCourseLang(storeRandomCourseLang);
      }
      prevRandomRef.current = storeRandomTopic;
      setStoreRandomTopic(null); // consume it
    }
  }, [storeRandomTopic, storeRandomCourseLang, setStoreRandomTopic]);

  // ─── Rotating placeholder with typing/fade effect ────────────────────
  const placeholders = tx.create.placeholders;
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState(placeholders[0]);
  const [isTyping, setIsTyping] = useState(true);
  const [charIndex, setCharIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Skip typing animation while user has typed something
    if (title.length > 0) {
      setDisplayedPlaceholder("");
      setIsTyping(false);
      return;
    }

    const currentPlaceholder = placeholders[placeholderIndex];

    if (isTyping) {
      if (charIndex <= currentPlaceholder.length) {
        const timeout = setTimeout(() => {
          setDisplayedPlaceholder(currentPlaceholder.slice(0, charIndex));
          setCharIndex(charIndex + 1);
        }, 35);
        return () => clearTimeout(timeout);
      } else {
        // Finished typing, wait then start fading
        const timeout = setTimeout(() => {
          setIsFading(true);
          setTimeout(() => {
            setPlaceholderIndex((placeholderIndex + 1) % placeholders.length);
            setCharIndex(0);
            setIsTyping(true);
            setIsFading(false);
          }, 500);
        }, 2200);
        return () => clearTimeout(timeout);
      }
    }
  }, [charIndex, isTyping, isFading, placeholderIndex, placeholders, title]);

  // ─── Fetch courses ────────────────────────────────────────────────────
  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch("/api/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses((data.courses as CourseData[]) || []);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // ─── Link management ──────────────────────────────────────────────────
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

  // ─── Generate course ──────────────────────────────────────────────────
  const generateCourse = async () => {
    if (!title.trim()) return;
    if (!canAffordCourse) {
      setError(tx.create.notEnoughFlames.replace("{cost}", String(flameCost)));
      return;
    }
    setLoading(true);
    setError("");
    setIsGenerating(true);

    try {
      const res = await fetch("/api/courses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sourceLinks: links,
          level,
          courseLang,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");

      const course = data.course as CourseData;
      setSelectedCourseId(course.id);
      setView("viewer");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
      setIsGenerating(false);
      // Refresh flame points after generation
      try {
        const res = await fetch("/api/flames");
        if (res.ok) {
          const data = await res.json();
          setFlamePoints(data.flamePoints);
        }
      } catch { /* ignore */ }
    }
  };

  // ─── Open a course ────────────────────────────────────────────────────
  const openCourse = (id: string) => {
    setSelectedCourseId(id);
    setView("viewer");
  };

  // ─── Helpers ──────────────────────────────────────────────────────────
  const levelLabels = tx.create.levels;
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
    <div className="max-w-3xl mx-auto px-6 md:px-10 pt-20 pb-8 md:pt-24 md:pb-16">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">
          <span className="gradient-text">{tx.create.title}</span>
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          {tx.create.subtitle}
        </p>
      </div>

      {/* ═══════════ Main creation card ═══════════ */}
      <div className="glass rounded-3xl p-6 md:p-10">
        {/* ─── Title input ─── */}
        <div className="mb-8">
          <label className="block text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">
            {tx.create.placeholder}
          </label>
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=""
              className="w-full px-6 py-5 rounded-2xl bg-night border border-border text-foreground text-lg font-bold placeholder:text-muted-foreground/50 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300"
              onKeyDown={(e) => e.key === "Enter" && generateCourse()}
              disabled={loading}
            />
            {/* Animated placeholder overlay */}
            {!title && (
              <div
                className={`absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-lg font-bold transition-opacity duration-500 ${
                  isFading ? "opacity-0" : "opacity-100"
                }`}
                aria-hidden="true"
              >
                <span className="text-muted-foreground/40">
                  {displayedPlaceholder}
                </span>
                <span className="inline-block w-0.5 h-5 bg-mauve/60 ml-0.5 align-middle animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* ─── Source links ─── */}
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

        {/* ─── Difficulty level selector ─── */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">
            <Signal className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {tx.create.level}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {levelLabels.map((label, i) => {
              const isSelected = level === i;
              return (
                <button
                  key={i}
                  onClick={() => setLevel(i)}
                  className={`relative px-4 py-4 rounded-2xl font-bold text-center cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? "bg-mauve/20 border-2 border-mauve text-mauve-light shadow-lg shadow-mauve/10"
                      : "glass border-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`flex gap-1 ${
                        isSelected ? "text-mauve-light" : "text-muted-foreground/50"
                      }`}
                    >
                      {[0, 1, 2].map((bar) => (
                        <div
                          key={bar}
                          className={`w-1.5 rounded-full transition-all duration-300 ${
                            bar <= i
                              ? isSelected
                                ? "bg-mauve-light h-5"
                                : "bg-muted-foreground/40 h-3"
                              : "bg-muted-foreground/20 h-2"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm md:text-base">{label}</span>
                  </div>
                  {/* Selected indicator dot */}
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-mauve border-2 border-night" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Course language selector ─── */}
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

        {/* ─── Error ─── */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold animate-[fadeIn_0.3s_ease-out]">
            {error}
          </div>
        )}

        {/* ─── Suggested topic banner ─── */}
        {showSuggested && suggestedTopic && (
          <div className="mb-6 p-4 rounded-2xl glass text-center transition-all duration-300">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
              ✨ {tx.create.suggested}
            </p>
            <p className="text-lg font-extrabold gradient-text">{suggestedTopic}</p>
          </div>
        )}

        {/* ─── Generate button ─── */}
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
              canAffordCourse
                ? "bg-night/50 text-muted-foreground border border-border"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              <Flame className="w-4 h-4" />
              <span>{flamePoints !== null ? flamePoints : "..."}</span>
              <span className="text-muted-foreground">/</span>
              <span className={canAffordCourse ? "" : "text-red-400"}>{flameCost}</span>
            </div>
            <button
              onClick={generateCourse}
              disabled={!title.trim() || loading || !canAffordCourse}
              className="flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-lg font-extrabold hover:from-mauve-light hover:to-mauve transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-mauve/25 hover:shadow-mauve/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{tx.create.generating}</span>
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
      </div>

      {/* ═══════════ Recent courses ═══════════ */}
      <div className="mt-10 md:mt-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-extrabold flex items-center gap-3">
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
  );
}
