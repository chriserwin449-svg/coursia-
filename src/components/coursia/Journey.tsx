"use client";

import { useState, useEffect, useRef } from "react";
import {
  Trophy,
  BookOpen,
  Clock,
  Target,
  Award,
  Loader2,
  Star,
  Calendar,
  TrendingUp,
  X,
  Flame,
} from "lucide-react";
import { BADGE_DEFINITIONS } from "@/lib/badges";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { getCurrentFlameType, getFlameProgress, formatFlamePoints, type FlameReward } from "@/lib/flames";

interface Stats {
  totalCourses: number;
  completedCourses: number;
  totalChapters: number;
  completedChapters: number;
  totalStudyTime: number;
  averageScore: number;
}

interface BadgeState {
  earned: typeof BADGE_DEFINITIONS;
  all: (typeof BADGE_DEFINITIONS[number] & { earned: boolean })[];
  next: typeof BADGE_DEFINITIONS[number] | null;
  progress: { current: number; next: number; percentage: number };
}

interface StudyTimeData {
  today: number;
  last3Days: number;
  thisWeek: number;
  thisMonth: number;
  dailyBreakdown: Array<{ date: string; minutes: number; courses: number }>;
}

interface FlameData {
  flamePoints: number;
  flameType: { id: string; name: string; nameEn: string; emoji: string; minPoints: number; maxPoints: number; color: string; description: string; descriptionEn: string };
  flameProgress: { current: number; next: number; percentage: number };
  hasSubscription: boolean;
  totalEarned: number;
  totalSpent: number;
  rewards: FlameReward[];
}

type StudyTimePeriod = "today" | "last3" | "week" | "month";

export default function Journey() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const [stats, setStats] = useState<Stats | null>(null);
  const [badgeState, setBadgeState] = useState<BadgeState | null>(null);
  const [studyTime, setStudyTime] = useState<StudyTimeData | null>(null);
  const [flameData, setFlameData] = useState<FlameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<StudyTimePeriod>("today");
  const [showStudyDetail, setShowStudyDetail] = useState(false);
  const [showFlameCollection, setShowFlameCollection] = useState(false);
  const [isActivityActive, setIsActivityActive] = useState(true);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [badgesRes, studyRes, flamesRes] = await Promise.all([
          fetch("/api/badges"),
          fetch("/api/study-time"),
          fetch("/api/flames"),
        ]);
        if (badgesRes.ok) {
          const data = await badgesRes.json();
          setStats(data.stats);
          setBadgeState(data.badges);
        }
        if (studyRes.ok) {
          setStudyTime(await studyRes.json());
        }
        if (flamesRes.ok) {
          setFlameData(await flamesRes.json());
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // ── Activity tracking for flame bar ──
  useEffect(() => {
    const handleActivity = () => {
      setIsActivityActive(true);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      activityTimerRef.current = setTimeout(() => setIsActivityActive(false), 30000);
    };
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("scroll", handleActivity);
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-mauve" />
      </div>
    );
  }

  // ─── Flame bar data ────────────────────────────────────────────────────
  const flamePoints = flameData?.flamePoints ?? 0;
  const flameType = flameData?.flameType ?? getCurrentFlameType(flamePoints);
  const flameProg = flameData?.flameProgress ?? getFlameProgress(flamePoints);
  const isMaxFlame = flameType.minPoints === flameType.maxPoints;

  const flameBarClass = isActivityActive
    ? "rounded-2xl px-5 pt-4 pb-5 mb-2 relative overflow-hidden cursor-pointer transition-all duration-700 flame-card-border-pulse hover:scale-105"
    : "rounded-2xl px-5 pt-4 pb-5 mb-2 relative overflow-hidden cursor-pointer transition-all duration-700 hover:scale-105";

  const flameIconClass = isActivityActive
    ? "w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center transition-all duration-700 animate-pulse-glow scale-110"
    : "w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center transition-all duration-700 scale-100";

  const formatTime = (minutes: number) => {
    if (minutes < 1) return `0 ${tx.journey.min}`;
    if (minutes < 60) return `${Math.round(minutes)} ${tx.journey.min}`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) return `${hours}${tx.journey.hours}`;
    return `${hours}${tx.journey.hours} ${mins}${tx.journey.min}`;
  };

  const periodLabels: Record<StudyTimePeriod, string> = {
    today: tx.journey.today,
    last3: tx.journey.last3Days,
    week: tx.journey.thisWeek,
    month: tx.journey.thisMonth,
  };

  const periodValues: Record<StudyTimePeriod, number> = {
    today: studyTime?.today ?? 0,
    last3: studyTime?.last3Days ?? 0,
    week: studyTime?.thisWeek ?? 0,
    month: studyTime?.thisMonth ?? 0,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 pt-14 sm:pt-20 pb-8 md:pt-24 md:pb-16 fade-in">
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3">
          <span className="gradient-text">{tx.journey.title}</span>
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg">{tx.journey.subtitle}</p>
      </div>

      {/* ═══ FLAME PROGRESS BAR ═══ */}
      <div
        className={flameBarClass}
        style={{ background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(248, 113, 113, 0.1), rgba(220, 38, 38, 0.08))", border: "1px solid rgba(239, 68, 68, 0.3)" }}
        onClick={() => setShowFlameCollection(true)}
      >
        {/* Animated background glow orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="flame-orb-1 absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[60px]" style={{ background: "rgba(239, 68, 68, 0.25)" }} />
          <div className="flame-orb-2 absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-[50px]" style={{ background: "rgba(249, 115, 22, 0.18)" }} />
          <div className="flame-orb-1 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-16 rounded-full blur-[40px]" style={{ background: "rgba(249, 115, 22, 0.12)" }} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={flameIconClass}>
                <span className="text-2xl">{flameType.emoji}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-400">
                  {lang === "fr" ? flameType.name : flameType.nameEn}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {formatFlamePoints(flamePoints)} {lang === "fr" ? "points de flamme" : "flame points"}
                  {!isMaxFlame && (
                    <span className="text-muted-foreground/60"> · {flameProg.percentage}% vers {(() => {
                      const nextIdx = (["etincelle", "flamme", "brasier", "incendie", "meteor", "supernova", "legende"]).indexOf(flameType.id) + 1;
                      const allTypes = [
                        { fr: "Étincelle", en: "Spark" },
                        { fr: "Flamme", en: "Flame" },
                        { fr: "Brasier", en: "Brazier" },
                        { fr: "Incendie", en: "Wildfire" },
                        { fr: "Météore", en: "Meteor" },
                        { fr: "Supernova", en: "Supernova" },
                        { fr: "Légende", en: "Legend" },
                      ];
                      return nextIdx < allTypes.length ? allTypes[nextIdx][lang] : flameType.name;
                    })()}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-400" />
              <span className="text-2xl font-extrabold text-red-400">
                {flameType.emoji} {formatFlamePoints(flamePoints)}
              </span>
            </div>
          </div>
          {/* Progress bar with effects */}
          <div className="relative">
            {/* Floating ember particles above the bar */}
            {flamePoints > 0 && (
              <div className="absolute -top-6 left-0 right-0 h-6 pointer-events-none overflow-visible">
                {Array.from({ length: 8 }, (_, i) => {
                  const seed = (i + 1) * 3.7;
                  const rand = (s: number) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
                  const barWidth = Math.min(flameProg.percentage, 100);
                  return (
                    <span
                      key={i}
                      className="flame-bar-ember"
                      style={{
                        left: `${rand(seed) * barWidth}%`,
                        bottom: 0,
                        width: `${2 + rand(seed + 1) * 3}px`,
                        height: `${2 + rand(seed + 1) * 3}px`,
                        background: `radial-gradient(circle, #fbbf24, ${i % 3 === 0 ? "#ef4444" : "#f97316"})`,
                        boxShadow: `0 0 ${4 + rand(seed + 2) * 6}px #f97316, 0 0 ${8 + rand(seed + 2) * 8}px #ef444488`,
                        ["--ember-rise" as string]: `${20 + rand(seed + 3) * 25}px`,
                        ["--ember-drift" as string]: `${(rand(seed + 4) - 0.5) * 16}px`,
                        ["--ember-delay" as string]: `${rand(seed + 5) * 3}s`,
                        ["--ember-dur" as string]: `${1.5 + rand(seed + 6) * 2}s`,
                      }}
                    />
                  );
                })}
              </div>
            )}
            {/* The bar itself */}
            <div className="w-full h-5 rounded-full bg-night/60 overflow-hidden border border-red-400/20 flame-bar-container">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out relative ${flamePoints > 0 ? "flame-bar-fill" : ""}`}
                style={{
                  width: mounted ? `${isMaxFlame ? 100 : Math.max(Math.min(flameProg.percentage, 100), 8)}%` : "0%",
                  background: flamePoints === 0 ? "linear-gradient(90deg, #ef4444, #f87171, #fb923c)" : undefined,
                  boxShadow: flamePoints > 0 ? "0 0 15px rgba(239, 68, 68, 0.4), 0 0 30px rgba(249, 115, 22, 0.2)" : "none",
                }}
              >
                {/* Shimmer sweep */}
                <div className="flame-bar-shimmer-effect" />
                {/* Glowing tip */}
                {flamePoints > 0 && <div className="flame-bar-tip" />}
              </div>
            </div>
            {/* Reflection glow below the bar */}
            <div
              className="flame-bar-reflection mt-1"
              style={{
                width: mounted ? `${isMaxFlame ? 100 : Math.min(flameProg.percentage, 100)}%` : "0%",
                background: flamePoints > 0
                  ? "linear-gradient(90deg, #dc2626, #f97316, #f59e0b, #f97316, #dc2626)"
                  : "none",
                backgroundSize: "200% 100%",
                animation: flamePoints > 0 ? "flame-bar-fire-gradient 3s ease-in-out infinite" : "none",
                transition: "width 1s ease-out",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground/60 mt-3 text-center">
            {isMaxFlame
              ? (lang === "fr" ? "Tu as atteint le niveau maximum !" : "You reached the maximum level!")
              : (lang === "fr"
                ? `${flameProg.current} / ${flameType.maxPoints + 1 - flameType.minPoints} points dans ce palier`
                : `${flameProg.current} / ${flameType.maxPoints + 1 - flameType.minPoints} points in this tier`
              )
            }
          </p>
          {/* Points earned / lost summary */}
          <div className="flex items-center justify-center gap-6 mt-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-emerald-400 font-bold">+</span>
              <span className="text-muted-foreground">{lang === "fr" ? "Gagnés" : "Earned"}:</span>
              <span className="text-emerald-400 font-bold">{formatFlamePoints(flameData?.totalEarned ?? 0)}</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-red-400 font-bold">-</span>
              <span className="text-muted-foreground">{lang === "fr" ? "Perdus" : "Lost"}:</span>
              <span className="text-red-400 font-bold">{formatFlamePoints(Math.abs(flameData?.totalSpent ?? 0))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid — 3 columns */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-10">
        {[
          {
            icon: BookOpen,
            label: tx.journey.coursesCreated,
            value: stats?.totalCourses ?? 0,
            color: "text-mauve-light",
            bgColor: "bg-mauve/10",
            glowColor: "rgba(124, 92, 191, 0.35)",
            borderColor: "border-mauve/20",
            delay: "0ms",
            onClick: () => useAppStore.getState().setView("library"),
          },
          {
            icon: Trophy,
            label: tx.journey.coursesDone,
            value: stats?.completedCourses ?? 0,
            color: "text-gold",
            bgColor: "bg-gold/10",
            glowColor: "rgba(212, 168, 67, 0.35)",
            borderColor: "border-gold/20",
            delay: "50ms",
            onClick: () => setShowFlameCollection(true),
          },
          {
            icon: Flame,
            label: lang === "fr" ? "Points de flamme" : "Flame points",
            value: `${flameData?.flamePoints ?? 0}`,
            color: "text-red-400",
            bgColor: "bg-red-500/10",
            glowColor: "rgba(239, 68, 68, 0.35)",
            borderColor: "border-red-500/20",
            delay: "100ms",
            onClick: () => setShowFlameCollection(true),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            onClick={() => stat.onClick?.()}
            className={`glass rounded-3xl p-4 sm:p-5 text-center fade-in-up cursor-pointer transition-all duration-300 border border-transparent group stat-box-hover ${stat.borderColor}`}
            style={{
              animationDelay: mounted ? stat.delay : "0ms",
              "--glow-color": stat.glowColor,
            } as React.CSSProperties}
          >
            <div
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl ${stat.bgColor} flex items-center justify-center mx-auto mb-2 sm:mb-3 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}
            >
              <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color} transition-all duration-300 group-hover:scale-110`} />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold mb-0.5 sm:mb-1 transition-colors duration-300 group-hover:text-foreground">{stat.value}</p>
            <p className="text-xs sm:text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Study Time + Next Badge Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {/* Study Time Card - Clickable */}
        <div
          className="glass rounded-3xl p-6 fade-in-up card-hover-glow"
          style={{ animationDelay: mounted ? "200ms" : "0ms", "--glow-color": "rgba(59, 130, 246, 0.3)" } as React.CSSProperties}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold">{tx.journey.studyTime}</h3>
            <button
              onClick={() => setShowStudyDetail(true)}
              className="ml-auto p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
            >
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Time period tabs */}
          <div className="flex gap-2 mb-4">
            {(["today", "last3", "week", "month"] as StudyTimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  selectedPeriod === period
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                    : "bg-night/50 text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                {periodLabels[period]}
              </button>
            ))}
          </div>

          {/* Selected period value */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-blue-400">
                {formatTime(periodValues[selectedPeriod])}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedPeriod === "today" && tx.journey.studyTimeTodayDesc}
                {selectedPeriod === "last3" && tx.journey.studyTime3DaysDesc}
                {selectedPeriod === "week" && tx.journey.studyTimeWeekDesc}
                {selectedPeriod === "month" && tx.journey.studyTimeMonthDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Next Badge */}
        <div
          className="glass rounded-3xl p-6 fade-in-up card-hover-glow"
          style={{ animationDelay: mounted ? "250ms" : "0ms", "--glow-color": "rgba(212, 168, 67, 0.3)" } as React.CSSProperties}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-mauve-light" />
            </div>
            <h3 className="text-lg font-bold">{tx.journey.nextBadge}</h3>
          </div>
          {badgeState?.next ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{badgeState.next.emoji}</span>
                <div>
                  <p className="font-bold">{badgeState.next.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {badgeState.next.threshold} {tx.journey.coursesCompleted}
                  </p>
                </div>
              </div>
              <div className="w-full h-3 rounded-full bg-night overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-mauve to-gold progress-bar-animate"
                  style={{
                    width: mounted ? `${badgeState.progress.percentage}%` : "0%",
                    transition: "width 1s ease-out 0.3s",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.completedCourses ?? 0}/{badgeState.next.threshold}{" "}
                {tx.journey.courses}
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-3xl mb-2">🏆</p>
              <p className="font-bold gradient-text">{tx.journey.allBadges}</p>
              <p className="text-sm text-muted-foreground">{tx.journey.allBadgesDesc}</p>
            </div>
          )}
        </div>
      </div>

      {/* Badges Section */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <Award className="w-6 h-6 text-gold" />
          <h2 className="text-2xl font-extrabold">{tx.journey.myBadges}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {BADGE_DEFINITIONS.map((badge, i) => {
            const earned = (stats?.completedCourses ?? 0) >= badge.threshold;
            return (
              <div
                key={badge.id}
                className={`rounded-3xl p-5 text-center transition-all duration-300 fade-in-up card-hover-glow ${
                  earned
                    ? "glass border border-gold/20"
                    : "bg-night/50 border border-border opacity-50"
                }`}
                style={{ animationDelay: mounted ? `${300 + i * 40}ms` : "0ms", "--glow-color": earned ? "rgba(212, 168, 67, 0.3)" : "rgba(124, 92, 191, 0.2)" } as React.CSSProperties}
              >
                <div className={`text-4xl mb-3 ${earned ? "" : "grayscale opacity-40"}`}>{badge.emoji}</div>
                <h4 className={`text-sm font-bold mb-1 ${earned ? "text-foreground" : "text-muted-foreground"}`}>{badge.name}</h4>
                <p className={`text-xs mb-2 ${earned ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                  {badge.threshold} {tx.journey.courses}
                </p>
                {earned && (
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-gold">
                    <Star className="w-3 h-3" /> {tx.journey.earned}
                  </div>
                )}
                {!earned && (
                  <div className="w-full h-1.5 rounded-full bg-night overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-muted-foreground/30 progress-bar-animate"
                      style={{
                        width: mounted ? `${Math.min(((stats?.completedCourses ?? 0) / badge.threshold) * 100, 100)}%` : "0%",
                        transition: "width 0.8s ease-out",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Motivational Quote */}
      <div
        className="glass rounded-3xl p-8 text-center fade-in-up"
        style={{ animationDelay: mounted ? "500ms" : "0ms" }}
      >
        <p className="text-xl md:text-2xl font-bold italic text-foreground/80 leading-relaxed">
          &ldquo;{tx.journey.quote}&rdquo;
        </p>
        <p className="text-sm text-muted-foreground mt-4">— {tx.journey.quoteAuthor}</p>
      </div>

      {/* ═══════════ FLAME COLLECTION MODAL ═══════════ */}
      {showFlameCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowFlameCollection(false)}>
          <div
            className="bg-night-light border border-border rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar mx-4 animate-fade-in-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-night-light z-10 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                  <span className="text-xl">{flameType.emoji}</span>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold">
                    {lang === "fr" ? "Collection de Flammes" : "Flame Collection"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {flameData?.rewards?.filter((r) => r.isEarned).length ?? 0}/{flameData?.rewards?.length ?? 0}{" "}
                    {lang === "fr" ? "récompenses" : "rewards"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFlameCollection(false)}
                className="p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {(flameData?.rewards ?? []).map((reward, i) => {
                const earned = reward.isEarned;
                return (
                  <div
                    key={reward.id}
                    className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${
                      earned
                        ? "bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20"
                        : "bg-night/50 border-border opacity-50"
                    }`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {/* Earned glow effect */}
                    {earned && (
                      <div
                        className="absolute inset-0 rounded-2xl opacity-30"
                        style={{
                          boxShadow: "inset 0 0 20px rgba(245, 158, 11, 0.15), 0 0 15px rgba(245, 158, 11, 0.08)",
                          animation: "pulse 3s ease-in-out infinite",
                        }}
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-4 w-full">
                      {/* Emoji with glow or lock */}
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                          earned
                            ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20"
                            : "bg-night/80"
                        }`}
                        style={
                          earned
                            ? {
                                boxShadow: "0 0 20px rgba(245, 158, 11, 0.2), 0 0 40px rgba(245, 158, 11, 0.1)",
                              }
                            : undefined
                        }
                      >
                        {earned ? (
                          <span className="text-3xl" style={{ filter: "drop-shadow(0 0 6px rgba(245, 158, 11, 0.5))" }}>{reward.emoji}</span>
                        ) : (
                          <span className="text-2xl grayscale">{reward.emoji}</span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`font-bold text-sm ${earned ? "text-amber-400" : "text-muted-foreground"}`}>
                            {lang === "fr" ? reward.name : reward.nameEn}
                          </p>
                          {earned && (
                            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">✓</span>
                          )}
                        </div>
                        <p className={`text-xs ${earned ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                          {lang === "fr" ? reward.description : reward.descriptionEn}
                        </p>
                        <p className="text-[10px] text-muted-foreground/40 mt-1">
                          {formatFlamePoints(reward.points)} {lang === "fr" ? "pts" : "pts"}
                        </p>
                      </div>
                      {/* Progress or check */}
                      <div className="flex-shrink-0">
                        {earned ? (
                          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
                            <Star className="w-4 h-4 text-amber-400" />
                          </div>
                        ) : (
                          <div className="text-right">
                            <p className="text-xs font-bold text-muted-foreground/50">
                              {Math.min(Math.round((flamePoints / reward.points) * 100), 99)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Bottom hint */}
              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground/40">
                  {lang === "fr"
                    ? "Continue à étudier pour débloquer plus de récompenses !"
                    : "Keep studying to unlock more rewards!"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ STUDY TIME DETAIL PANEL (Modal) ═══════════ */}
      {showStudyDetail && studyTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowStudyDetail(false)}>
          <div className="bg-night-light border border-border rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar mx-4 animate-fade-in-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-night-light z-10 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-extrabold">{tx.journey.studyTimeDetail}</h2>
              </div>
              <button onClick={() => setShowStudyDetail(false)} className="p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: tx.journey.today, value: formatTime(studyTime.today), color: "text-blue-400", bg: "bg-blue-500/10" },
                  { label: tx.journey.last3Days, value: formatTime(studyTime.last3Days), color: "text-blue-300", bg: "bg-blue-500/5" },
                  { label: tx.journey.thisWeek, value: formatTime(studyTime.thisWeek), color: "text-blue-400", bg: "bg-blue-500/10" },
                  { label: tx.journey.thisMonth, value: formatTime(studyTime.thisMonth), color: "text-blue-300", bg: "bg-blue-500/5" },
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-2xl glass text-center">
                    <p className={`text-lg font-extrabold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Daily breakdown */}
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
                  {tx.journey.dailyBreakdown}
                </h3>
                {studyTime.dailyBreakdown.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{tx.journey.noStudyData}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {studyTime.dailyBreakdown.map((day) => {
                      const maxMinutes = Math.max(...studyTime.dailyBreakdown.map(d => d.minutes), 1);
                      const barWidth = Math.max(2, (day.minutes / maxMinutes) * 100);
                      return (
                        <div key={day.date} className="flex items-center gap-3 p-3 rounded-xl bg-night/50">
                          <div className="w-16 text-xs font-bold text-muted-foreground flex-shrink-0">
                            {new Date(day.date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                          <div className="flex-1 h-6 rounded-full bg-night overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500/60 to-blue-400/60 transition-all duration-500 flex items-center justify-end pr-2"
                              style={{ width: `${barWidth}%` }}
                            >
                              {day.minutes > 5 && (
                                <span className="text-[10px] font-bold text-blue-100">{formatTime(day.minutes)}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground flex-shrink-0 w-16 text-right">
                            {formatTime(day.minutes)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
