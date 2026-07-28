"use client";

import { useState, useEffect } from "react";
import { Globe, Shuffle, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function TopBar() {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const tx = t(lang);
  const setView = useAppStore((s) => s.setView);
  const view = useAppStore((s) => s.view);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setRandomTopic = useAppStore((s) => s.setRandomTopic);
  const setRandomCourseLang = useAppStore((s) => s.setRandomCourseLang);
  const userId = useAppStore((s) => s.userId);
  const setInTrial = useAppStore((s) => s.setInTrial);
  const setTrialDaysRemaining = useAppStore((s) => s.setTrialDaysRemaining);
  const setTrialCoursesGenerated = useAppStore((s) => s.setTrialCoursesGenerated);

  const [loadingRandom, setLoadingRandom] = useState(false);
  const [trialInfo, setTrialInfo] = useState<{ days: number; remaining: number; max: number } | null>(null);

  // Fetch paywall-status on mount to get trial info
  useEffect(() => {
    const fetchTrialInfo = async () => {
      if (!userId) return;
      try {
        const headers: Record<string, string> = {};
        headers["Authorization"] = `Bearer ${userId}`;
        const res = await fetch("/api/courses/paywall-status", { headers });
        const data = await res.json();
        if (data.inTrial) {
          setInTrial(true);
          setTrialDaysRemaining(data.trialDaysRemaining || 0);
          setTrialCoursesGenerated(data.trialCoursesGenerated || 0);
          setTrialInfo({
            days: data.trialDaysRemaining || 0,
            remaining: (data.trialCoursesMax || 3) - (data.trialCoursesGenerated || 0),
            max: data.trialCoursesMax || 3,
          });
        } else {
          setInTrial(false);
          setTrialInfo(null);
        }
      } catch {
        // silently ignore
      }
    };
    fetchTrialInfo();
  }, [userId, setInTrial, setTrialDaysRemaining, setTrialCoursesGenerated]);


  const generateRandom = async () => {
    setLoadingRandom(true);
    try {
      const res = await fetch("/api/courses/random", { method: "POST" });
      const data = await res.json();
      if (data.success && data.topic?.title) {
        setRandomTopic(data.topic.title);
        setRandomCourseLang(lang);
        setView("create");
      } else {
        console.error("[TopBar] Random topic generation failed:", data);
      }
    } catch (err) {
      console.error("[TopBar] Random topic fetch error:", err);
    } finally {
      setLoadingRandom(false);
    }
  };

  // Build trial counter text
  const trialCounterText = trialInfo
    ? tx.create.trialCounter
        .replace("{days}", String(trialInfo.days))
        .replace("{suffix}", trialInfo.days > 1 ? (lang === "fr" ? tx.create.trialCounterDays : tx.create.trialCounterDays) : (lang === "fr" ? tx.create.trialCounterDay : tx.create.trialCounterDay))
        .replace("{remaining}", String(trialInfo.remaining))
        .replace("{max}", String(trialInfo.max))
    : null;

  return (
    <div
      className={`fixed top-0 right-0 z-30 flex items-center gap-2 py-2 md:py-3 pr-4 pl-12 sm:pl-4 transition-all duration-300 ease-in-out ${
        collapsed
          ? "ml-0 md:ml-[72px]"
          : "ml-0 md:ml-[72px] lg:ml-64"
      }`}
    >
      {/* Trial counter pill — show when user is in trial */}
      {trialInfo && trialCounterText && (
        <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-gold/10 border border-gold/25 text-gold text-xs font-bold animate-fade-in">
          {trialCounterText}
        </div>
      )}

      {/* Random course topic — only on create page */}
      {view === "create" && (
      <div className="flex items-center rounded-2xl glass overflow-hidden">
        <button
          onClick={generateRandom}
          disabled={loadingRandom}
          title={tx.create.random}
          className="flex items-center gap-2 px-3 py-2.5 text-muted-foreground hover:text-gold hover:bg-gold/10 transition-all duration-200 cursor-pointer text-sm font-bold"
        >
          {loadingRandom ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Shuffle className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{tx.create.random}</span>
        </button>
      </div>
      )}

      {/* UI language toggle */}
      <button
        onClick={() => setLang(lang === "fr" ? "en" : "fr")}
        title={lang === "fr" ? "Switch to English" : "Passer en Français"}
        className="flex items-center gap-2 px-3 py-2.5 rounded-2xl glass text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-200 cursor-pointer text-sm font-bold"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">
          {lang === "fr" ? "🇬🇧 EN" : "🇫🇷 FR"}
        </span>
        <span className="sm:hidden">
          {lang === "fr" ? "EN" : "FR"}
        </span>
      </button>
    </div>
  );
}