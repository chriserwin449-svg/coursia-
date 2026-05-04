"use client";

import { useState, useEffect } from "react";
import {
  Trophy,
  BookOpen,
  Clock,
  Target,
  TrendingUp,
  Award,
  Loader2,
  Star,
  Flame,
} from "lucide-react";
import { BADGE_DEFINITIONS } from "@/lib/badges";
import type { BadgeDef } from "@/lib/badges";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

interface Stats {
  totalCourses: number;
  completedCourses: number;
  totalChapters: number;
  completedChapters: number;
  totalStudyTime: number;
  averageScore: number;
}

interface BadgeState {
  earned: BadgeDef[];
  all: (BadgeDef & { earned: boolean })[];
  next: BadgeDef | null;
  progress: { current: number; next: number; percentage: number };
}

export default function Journey() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const [stats, setStats] = useState<Stats | null>(null);
  const [badgeState, setBadgeState] = useState<BadgeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const fetchJourney = async () => {
      try {
        const res = await fetch("/api/badges");
        const data = await res.json();
        if (res.ok) {
          setStats(data.stats);
          setBadgeState(data.badges);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchJourney();
  }, []);

  // Trigger CSS animations after mount
  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-mauve" />
      </div>
    );
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} ${tx.journey.min}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}${tx.journey.hours} ${mins}${tx.journey.min}`;
  };

  const scoreMessage =
    stats?.averageScore !== undefined && stats.averageScore >= 80
      ? tx.journey.scoreExcellent
      : stats?.averageScore !== undefined && stats.averageScore >= 60
        ? tx.journey.scoreGood
        : tx.journey.scoreKeepGoing;

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 pt-20 pb-8 md:pt-24 md:pb-16 fade-in">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
          <span className="gradient-text">{tx.journey.title}</span>
        </h1>
        <p className="text-muted-foreground text-lg">{tx.journey.subtitle}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          {
            icon: BookOpen,
            label: tx.journey.coursesCreated,
            value: stats?.totalCourses ?? 0,
            color: "text-mauve-light",
            bgColor: "bg-mauve/10",
            delay: "0ms",
          },
          {
            icon: Trophy,
            label: tx.journey.coursesDone,
            value: stats?.completedCourses ?? 0,
            color: "text-gold",
            bgColor: "bg-gold/10",
            delay: "50ms",
          },
          {
            icon: Target,
            label: tx.journey.chapters,
            value: `${stats?.completedChapters ?? 0}/${stats?.totalChapters ?? 0}`,
            color: "text-green-400",
            bgColor: "bg-green-500/10",
            delay: "100ms",
          },
          {
            icon: Clock,
            label: tx.journey.studyTime,
            value: formatTime(stats?.totalStudyTime ?? 0),
            color: "text-blue-400",
            bgColor: "bg-blue-500/10",
            delay: "150ms",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass rounded-3xl p-5 text-center fade-in-up"
            style={{ animationDelay: mounted ? stat.delay : "0ms" }}
          >
            <div
              className={`w-12 h-12 rounded-2xl ${stat.bgColor} flex items-center justify-center mx-auto mb-3`}
            >
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <p className="text-2xl font-extrabold mb-1">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Average Score + Next Badge Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {/* Average Score */}
        <div
          className="glass rounded-3xl p-6 fade-in-up"
          style={{ animationDelay: mounted ? "200ms" : "0ms" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gold" />
            </div>
            <h3 className="text-lg font-bold">{tx.journey.avgScore}</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(124, 92, 191, 0.1)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#goldGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(stats?.averageScore ?? 0) * 2.64} 264`}
                  className="score-ring-progress"
                />
                <defs>
                  <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#d4a843" />
                    <stop offset="100%" stopColor="#e8c46a" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-extrabold">
                  {stats?.averageScore ?? 0}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{scoreMessage}</p>
            </div>
          </div>
        </div>

        {/* Next Badge */}
        <div
          className="glass rounded-3xl p-6 fade-in-up"
          style={{ animationDelay: mounted ? "250ms" : "0ms" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-mauve-light" />
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
              <p className="text-sm text-muted-foreground">
                {tx.journey.allBadgesDesc}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Badges Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-gold" />
            <h2 className="text-2xl font-extrabold">{tx.journey.myBadges}</h2>
          </div>
          <button
            onClick={() => setShowAllBadges(!showAllBadges)}
            className="text-sm font-semibold text-mauve-light hover:text-mauve-glow transition-colors cursor-pointer"
          >
            {showAllBadges ? tx.journey.showLess : tx.journey.showMore}
          </button>
        </div>

        <div
          className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${
            !showAllBadges && BADGE_DEFINITIONS.length > 4
              ? "max-h-80 overflow-hidden"
              : ""
          }`}
        >
          {BADGE_DEFINITIONS.map((badge, i) => {
            const earned = (stats?.completedCourses ?? 0) >= badge.threshold;
            return (
              <div
                key={badge.id}
                className={`rounded-3xl p-5 text-center transition-all duration-300 fade-in-up ${
                  earned
                    ? "glass border border-gold/20 animate-pulse-glow"
                    : "bg-night/50 border border-border opacity-50"
                }`}
                style={{
                  animationDelay: mounted ? `${300 + i * 40}ms` : "0ms",
                }}
              >
                <div
                  className={`text-4xl mb-3 ${earned ? "" : "grayscale opacity-40"}`}
                >
                  {badge.emoji}
                </div>
                <h4
                  className={`text-sm font-bold mb-1 ${earned ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {badge.name}
                </h4>
                <p
                  className={`text-xs mb-2 ${earned ? "text-muted-foreground" : "text-muted-foreground/50"}`}
                >
                  {badge.threshold} {tx.journey.courses}
                </p>
                {earned && (
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-gold">
                    <Star className="w-3 h-3" />
                    {tx.journey.earned}
                  </div>
                )}
                {!earned && (
                  <div className="w-full h-1.5 rounded-full bg-night overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-muted-foreground/30 progress-bar-animate"
                      style={{
                        width: mounted
                          ? `${Math.min(
                              ((stats?.completedCourses ?? 0) / badge.threshold) *
                                100,
                              100
                            )}%`
                          : "0%",
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
        <p className="text-sm text-muted-foreground mt-4">
          — {tx.journey.quoteAuthor}
        </p>
      </div>
    </div>
  );
}
