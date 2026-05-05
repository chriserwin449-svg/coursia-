"use client";

import { useState, useEffect } from "react";
import {
  Trophy,
  BookOpen,
  Clock,
  Target,
  Award,
  Loader2,
  Star,
  Flame,
  X,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { BADGE_DEFINITIONS } from "@/lib/badges";
import {
  FLAME_TYPES,
  FLAME_REWARDS,
  COURSE_CREATION_COST,
  getCurrentFlameType,
  formatFlamePoints,
} from "@/lib/flames";
import type { FlameType, FlameReward as FlameRewardType } from "@/lib/flames";
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
  earned: typeof BADGE_DEFINITIONS;
  all: (typeof BADGE_DEFINITIONS[number] & { earned: boolean })[];
  next: typeof BADGE_DEFINITIONS[number] | null;
  progress: { current: number; next: number; percentage: number };
}

interface FlameState {
  flamePoints: number;
  flameType: FlameType;
  flameProgress: { current: number; next: number; percentage: number };
  rewards: FlameRewardType[];
  courseCreationCost: number;
  totalEarned: number;
  totalSpent: number;
  transactions: Array<{
    id: string;
    amount: number;
    reason: string;
    courseId: string | null;
    chapterId: string | null;
    createdAt: string;
  }>;
}

export default function Journey() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const [stats, setStats] = useState<Stats | null>(null);
  const [badgeState, setBadgeState] = useState<BadgeState | null>(null);
  const [flameState, setFlameState] = useState<FlameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showFlamePanel, setShowFlamePanel] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [badgesRes, flamesRes] = await Promise.all([
          fetch("/api/badges"),
          fetch("/api/flames"),
        ]);
        if (badgesRes.ok) {
          const data = await badgesRes.json();
          setStats(data.stats);
          setBadgeState(data.badges);
        }
        if (flamesRes.ok) {
          setFlameState(await flamesRes.json());
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

  const currentFlame = flameState?.flameType ?? getCurrentFlameType(0);

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

      {/* Flame Points + Next Badge Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {/* Flame Points Card */}
        <button
          onClick={() => setShowFlamePanel(true)}
          className="glass rounded-3xl p-6 fade-in-up text-left cursor-pointer hover:bg-white/5 transition-all duration-300 group"
          style={{ animationDelay: mounted ? "200ms" : "0ms" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${currentFlame.color}20` }}
              >
                <Flame className="w-5 h-5" style={{ color: currentFlame.color }} />
              </div>
              <h3 className="text-lg font-bold">{tx.journey.flames}</h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${currentFlame.color}15`, color: currentFlame.color }}>
              {currentFlame.emoji} {lang === "fr" ? currentFlame.name : currentFlame.nameEn}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={currentFlame.color}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(flameState?.flameProgress.percentage ?? 0) * 2.64} 264`}
                  className="score-ring-progress"
                  style={{ filter: `drop-shadow(0 0 6px ${currentFlame.color}40)` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-extrabold" style={{ color: currentFlame.color }}>
                  {flameState ? formatFlamePoints(flameState.flamePoints) : "0"}
                </span>
                <span className="text-[10px] text-muted-foreground">/ 10 000</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <ArrowUpRight className="w-3 h-3 text-green-400" />
                <span>+{flameState ? formatFlamePoints(flameState.totalEarned) : "0"} {tx.journey.totalEarned}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowDownLeft className="w-3 h-3 text-red-400" />
                <span>-{flameState ? formatFlamePoints(flameState.totalSpent) : "0"} {tx.journey.totalSpent}</span>
              </div>
              <div className="mt-3 w-full h-2 rounded-full bg-night overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: mounted ? `${flameState?.flameProgress.percentage ?? 0}%` : "0%",
                    background: `linear-gradient(90deg, ${currentFlame.color}, ${currentFlame.color}cc)`,
                  }}
                />
              </div>
            </div>
          </div>
        </button>

        {/* Next Badge */}
        <div
          className="glass rounded-3xl p-6 fade-in-up"
          style={{ animationDelay: mounted ? "250ms" : "0ms" }}
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
                className={`rounded-3xl p-5 text-center transition-all duration-300 fade-in-up ${
                  earned
                    ? "glass border border-gold/20"
                    : "bg-night/50 border border-border opacity-50"
                }`}
                style={{ animationDelay: mounted ? `${300 + i * 40}ms` : "0ms" }}
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

      {/* ═══════════ FLAME DETAILS PANEL (Modal) ═══════════ */}
      {showFlamePanel && flameState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowFlamePanel(false)}>
          <div className="bg-night-light border border-border rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar mx-4 animate-fade-in-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-night-light z-10">
              <div className="flex items-center gap-3">
                <Flame className="w-6 h-6" style={{ color: currentFlame.color }} />
                <h2 className="text-xl font-extrabold">{tx.journey.myFlames}</h2>
              </div>
              <button onClick={() => setShowFlamePanel(false)} className="p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Balance */}
              <div className="text-center p-6 rounded-2xl" style={{ backgroundColor: `${currentFlame.color}08`, border: `1px solid ${currentFlame.color}20` }}>
                <div className="text-5xl mb-2">{currentFlame.emoji}</div>
                <p className="text-3xl font-extrabold" style={{ color: currentFlame.color }}>
                  {formatFlamePoints(flameState.flamePoints)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {lang === "fr" ? currentFlame.name : currentFlame.nameEn} — {lang === "fr" ? currentFlame.description : currentFlame.descriptionEn}
                </p>
                <div className="flex justify-center gap-6 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-green-400" /> +{formatFlamePoints(flameState.totalEarned)}</span>
                  <span className="flex items-center gap-1"><ArrowDownLeft className="w-3 h-3 text-red-400" /> -{formatFlamePoints(flameState.totalSpent)}</span>
                </div>
              </div>

              {/* Flame Types Progression */}
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">{tx.journey.currentFlame}</h3>
                <div className="grid grid-cols-7 gap-2">
                  {FLAME_TYPES.map((ft) => {
                    const isActive = ft.id === currentFlame.id;
                    const isPast = flameState.flamePoints >= ft.minPoints;
                    return (
                      <div key={ft.id} className={`text-center p-2 rounded-xl transition-all ${isActive ? "scale-110" : ""} ${isPast ? "" : "opacity-30"}`}
                        style={isActive ? { backgroundColor: `${ft.color}15`, border: `1px solid ${ft.color}30` } : {}}
                      >
                        <div className="text-xl">{ft.emoji}</div>
                        <div className="text-[9px] text-muted-foreground mt-1 font-medium">{ft.minPoints > 0 ? `${ft.minPoints / 1000 >= 1 ? `${ft.minPoints / 1000}k` : ft.minPoints}` : "0"}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 w-full h-2 rounded-full bg-night overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${flameState.flameProgress.percentage}%`,
                      background: `linear-gradient(90deg, ${currentFlame.color}, ${currentFlame.color}aa)`,
                    }}
                  />
                </div>
              </div>

              {/* Flame Rewards */}
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">{tx.journey.flameRewards}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {flameState.rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${reward.isEarned ? "glass border border-gold/20" : "bg-night/50 opacity-50"}`}
                    >
                      <span className="text-2xl">{reward.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{lang === "fr" ? reward.name : reward.nameEn}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{formatFlamePoints(reward.points)} 🔥</p>
                      </div>
                      {reward.isEarned && <Star className="w-3.5 h-3.5 text-gold flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              {flameState.transactions.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">{tx.journey.recentActivity}</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {flameState.transactions.map((tx_) => (
                      <div key={tx_.id} className="flex items-center justify-between p-3 rounded-xl bg-night/50 text-sm">
                        <div className="flex items-center gap-2">
                          {tx_.amount > 0 ? (
                            <ArrowUpRight className="w-4 h-4 text-green-400" />
                          ) : (
                            <ArrowDownLeft className="w-4 h-4 text-red-400" />
                          )}
                          <span className="text-muted-foreground">
                            {tx_.reason === "chapter_complete" ? tx.journey.chapterFlame
                              : tx_.reason === "course_complete" ? tx.journey.courseFlame
                              : tx_.reason === "course_creation" ? tx.journey.courseCreationSpend
                              : tx_.reason}
                          </span>
                        </div>
                        <span className={`font-bold ${tx_.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                          {tx_.amount > 0 ? "+" : ""}{formatFlamePoints(tx_.amount)} 🔥
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
