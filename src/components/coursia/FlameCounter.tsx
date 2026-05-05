"use client";

import { useState, useEffect, useRef } from "react";
import { Flame, X, ArrowUpRight, ArrowDownLeft, Star } from "lucide-react";
import {
  getCurrentFlameType,
  getFlameProgress,
  COURSE_CREATION_COST,
  FLAME_TYPES,
  FLAME_REWARDS,
  formatFlamePoints,
} from "@/lib/flames";
import type { FlameReward as FlameRewardType } from "@/lib/flames";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

interface FlameState {
  flamePoints: number;
  hasSubscription: boolean;
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
  rewards: FlameRewardType[];
  flameProgress: { current: number; next: number; percentage: number };
}

export default function FlameCounter() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const view = useAppStore((s) => s.view);

  const [state, setState] = useState<FlameState | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [animatePoints, setAnimatePoints] = useState(false);
  const prevPointsRef = useRef<number>(0);
  const fetchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch flame data
  useEffect(() => {
    let cancelled = false;
    
    const fetchFlames = async () => {
      try {
        const res = await fetch("/api/flames");
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.flamePoints !== undefined) {
            setState((prev) => {
              const prevPoints = prev?.flamePoints ?? 0;
              if (data.flamePoints !== prevPoints) {
                setAnimatePoints(true);
                setTimeout(() => setAnimatePoints(false), 600);
              }
              prevPointsRef.current = data.flamePoints;
              return {
                flamePoints: data.flamePoints,
                hasSubscription: data.hasSubscription ?? false,
                totalEarned: data.totalEarned ?? 0,
                totalSpent: data.totalSpent ?? 0,
                transactions: data.transactions ?? [],
                rewards: data.rewards ?? [],
                flameProgress: data.flameProgress ?? { current: 0, next: 100, percentage: 0 },
              };
            });
          }
        }
      } catch {
        // silently fail
      }
    };
    
    fetchFlames();
    fetchIntervalRef.current = setInterval(fetchFlames, 5000);
    return () => {
      cancelled = true;
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
    };
  }, []);

  // Don't show on landing page
  if (view === "landing") return null;

  // If user has subscription, show a simpler version
  if (state?.hasSubscription) {
    const flameType = getCurrentFlameType(state.flamePoints);
    return (
      <button
        onClick={() => setShowPanel(true)}
        className="fixed top-20 left-[88px] md:left-[280px] z-20 flex items-center gap-2 px-4 py-2 rounded-full glass cursor-pointer transition-all duration-300 hover:scale-105 group"
      >
        <span className="text-lg">{flameType.emoji}</span>
        <span className="text-sm font-bold" style={{ color: flameType.color }}>
          {formatFlamePoints(state.flamePoints)}
        </span>
      </button>
    );
  }

  const flameType = state ? getCurrentFlameType(state.flamePoints) : getCurrentFlameType(0);
  const canAfford = (state?.flamePoints ?? 0) >= COURSE_CREATION_COST;

  return (
    <>
      {/* ── Floating Flame Counter (top-left, below TopBar) ── */}
      <button
        onClick={() => setShowPanel(true)}
        className="fixed top-20 left-[88px] md:left-[280px] z-20 flex items-center gap-3 px-4 py-2.5 rounded-2xl glass cursor-pointer transition-all duration-300 hover:scale-105 group"
        style={{
          boxShadow: `0 0 20px ${flameType.color}15, 0 0 40px ${flameType.color}08`,
          borderColor: `${flameType.color}25`,
        }}
      >
        {/* Flame icon with pulse */}
        <div className="relative">
          <Flame
            className="w-5 h-5 transition-colors duration-300"
            style={{ color: flameType.color }}
          />
          {animatePoints && (
            <span className="absolute -top-1 -right-1 text-xs animate-bounce">✨</span>
          )}
        </div>

        {/* Points display */}
        <span
          className={`text-sm font-extrabold tabular-nums transition-all duration-300 ${animatePoints ? "scale-125" : "scale-100"}`}
          style={{ color: flameType.color }}
        >
          {state ? formatFlamePoints(state.flamePoints) : "0"}
        </span>

        {/* Cost indicator */}
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
          canAfford ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
        }`}>
          <span>{COURSE_CREATION_COST}</span>
          <Flame className="w-3 h-3" />
        </div>
      </button>

      {/* ═══════════ FLAME DETAILS PANEL (Modal) ═══════════ */}
      {showPanel && state && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowPanel(false)}>
          <div className="bg-night-light border border-border rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar mx-4 animate-fade-in-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-night-light z-10 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <Flame className="w-6 h-6" style={{ color: flameType.color }} />
                <h2 className="text-xl font-extrabold">{tx.journey.myFlames}</h2>
              </div>
              <button onClick={() => setShowPanel(false)} className="p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Balance */}
              <div className="text-center p-6 rounded-2xl" style={{ backgroundColor: `${flameType.color}08`, border: `1px solid ${flameType.color}20` }}>
                <div className="text-5xl mb-2">{flameType.emoji}</div>
                <p className="text-3xl font-extrabold" style={{ color: flameType.color }}>
                  {formatFlamePoints(state.flamePoints)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {lang === "fr" ? flameType.name : flameType.nameEn} — {lang === "fr" ? flameType.description : flameType.descriptionEn}
                </p>
                <div className="flex justify-center gap-6 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-green-400" /> +{formatFlamePoints(state.totalEarned)}</span>
                  <span className="flex items-center gap-1"><ArrowDownLeft className="w-3 h-3 text-red-400" /> -{formatFlamePoints(state.totalSpent)}</span>
                </div>
              </div>

              {/* Flame Types Progression */}
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">{tx.journey.currentFlame}</h3>
                <div className="grid grid-cols-7 gap-2">
                  {FLAME_TYPES.map((ft) => {
                    const isActive = ft.id === flameType.id;
                    const isPast = state.flamePoints >= ft.minPoints;
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
                      width: `${state.flameProgress.percentage}%`,
                      background: `linear-gradient(90deg, ${flameType.color}, ${flameType.color}aa)`,
                    }}
                  />
                </div>
              </div>

              {/* Flame Rewards */}
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">{tx.journey.flameRewards}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(state.rewards || FLAME_REWARDS).map((reward) => (
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
              {state.transactions.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">{tx.journey.recentActivity}</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {state.transactions.map((tx_) => (
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
    </>
  );
}
