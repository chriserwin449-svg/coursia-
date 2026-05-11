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
  Calendar,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { BADGE_DEFINITIONS } from "@/lib/badges";
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

interface StudyTimeData {
  today: number;
  last3Days: number;
  thisWeek: number;
  thisMonth: number;
  dailyBreakdown: Array<{ date: string; minutes: number; courses: number }>;
}

type StudyTimePeriod = "today" | "last3" | "week" | "month";

export default function Journey() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const [stats, setStats] = useState<Stats | null>(null);
  const [badgeState, setBadgeState] = useState<BadgeState | null>(null);
  const [studyTime, setStudyTime] = useState<StudyTimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<StudyTimePeriod>("today");
  const [showStudyDetail, setShowStudyDetail] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [badgesRes, studyRes] = await Promise.all([
          fetch("/api/badges"),
          fetch("/api/study-time"),
        ]);
        if (badgesRes.ok) {
          const data = await badgesRes.json();
          setStats(data.stats);
          setBadgeState(data.badges);
        }
        if (studyRes.ok) {
          setStudyTime(await studyRes.json());
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
    <div className="max-w-5xl mx-auto px-6 md:px-10 pt-20 pb-8 md:pt-24 md:pb-16 fade-in">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
          <span className="gradient-text">{tx.journey.title}</span>
        </h1>
        <p className="text-muted-foreground text-lg">{tx.journey.subtitle}</p>
      </div>

      {/* ═══ LEARNING PROGRESS BAR ═══ */}
      {(() => {
        const total = stats?.totalChapters ?? 0;
        const completed = stats?.completedChapters ?? 0;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const motivationalMsgs = lang === "fr"
          ? ["Bien commencé ! Continue comme ça !", "Tu progresses bien, ne lâche rien !", "Impressionnant ! Tu es sur la bonne voie !", "Tu es une machine à apprendre !", "Champion ! Rien ne t'arrête !"]
          : ["Great start! Keep going!", "You're making progress!", "Impressive! You're on the right track!", "You're a learning machine!", "Champion! Nothing stops you!"];
        const msgIdx = Math.min(Math.floor(pct / 20), motivationalMsgs.length - 1);

        return (
          <div className="rounded-3xl p-6 mb-8 fade-in-up relative overflow-hidden border border-mauve/20" style={{ background: "linear-gradient(135deg, rgba(124, 92, 191, 0.08), rgba(234, 179, 8, 0.04))" }}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-mauve/10 rounded-full blur-[60px]" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gold/8 rounded-full blur-[50px]" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-mauve/15 flex items-center justify-center">
                    <span className="text-2xl">📚</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold gradient-text">
                      {lang === "fr" ? "Ma Progression" : "My Progress"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {completed}/{total} {lang === "fr" ? "chapitres complétés" : "chapters completed"} · {pct}%
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gold max-w-[200px] text-right">
                  {total > 0 ? motivationalMsgs[msgIdx] : (lang === "fr" ? "Commence un cours pour voir ta progression !" : "Start a course to see your progress!")}
                </p>
              </div>
              <div className="w-full h-4 rounded-full bg-night/80 overflow-hidden border border-mauve/10">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out relative"
                  style={{
                    width: mounted ? `${Math.min(pct, 100)}%` : "0%",
                    background: "linear-gradient(90deg, #7c5cbf, #d4a843, #eab308)",
                    boxShadow: pct > 0 ? "0 0 15px rgba(234, 179, 8, 0.4)" : "none",
                  }}
                >
                  {pct > 0 && (
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          {
            icon: BookOpen,
            label: tx.journey.coursesCreated,
            value: stats?.totalCourses ?? 0,
            color: "text-mauve-light",
            bgColor: "bg-mauve/10",
            glowColor: "rgba(124, 92, 191, 0.3)",
            delay: "0ms",
          },
          {
            icon: Trophy,
            label: tx.journey.coursesDone,
            value: stats?.completedCourses ?? 0,
            color: "text-gold",
            bgColor: "bg-gold/10",
            glowColor: "rgba(212, 168, 67, 0.3)",
            delay: "50ms",
          },
          {
            icon: Target,
            label: tx.journey.chapters,
            value: `${stats?.completedChapters ?? 0}/${stats?.totalChapters ?? 0}`,
            color: "text-green-400",
            bgColor: "bg-green-500/10",
            glowColor: "rgba(34, 197, 94, 0.3)",
            delay: "100ms",
          },
          {
            icon: Zap,
            label: lang === "fr" ? "Score moyen" : "Avg Score",
            value: `${stats?.averageScore ?? 0}%`,
            color: "text-gold",
            bgColor: "bg-gold/10",
            glowColor: "rgba(212, 168, 67, 0.3)",
            delay: "150ms",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass rounded-3xl p-5 text-center fade-in-up card-hover-glow"
            style={{ animationDelay: mounted ? stat.delay : "0ms", "--glow-color": stat.glowColor } as React.CSSProperties}
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
