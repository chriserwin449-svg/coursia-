"use client";

import { useState } from "react";
import { Globe, Shuffle, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function TopBar() {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const tx = t(lang);
  const setView = useAppStore((s) => s.setView);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);

  const [loadingRandom, setLoadingRandom] = useState(false);
  const [randomLang, setRandomLang] = useState<"fr" | "en">(lang);

  // Keep randomLang in sync with UI language changes
  const updateLang = (newLang: "fr" | "en") => {
    setLang(newLang);
    setRandomLang(newLang);
  };

  const generateRandom = async () => {
    setLoadingRandom(true);
    try {
      const res = await fetch("/api/courses/random", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setView("create");
      sessionStorage.setItem("coursia_random_topic", data.topic.title);
      sessionStorage.setItem("coursia_random_lang", randomLang);
    } catch {
      // silently fail
    } finally {
      setLoadingRandom(false);
    }
  };

  return (
    <div
      className={`fixed top-0 right-0 z-30 flex items-center gap-2 py-3 pr-4 transition-all duration-300 ease-in-out ${
        collapsed ? "ml-[72px]" : "ml-[72px] md:ml-64"
      }`}
    >
      {/* ── Random course + Language selector (grouped together) ── */}
      <div className="flex items-center rounded-2xl glass overflow-hidden">
        {/* Course language selector (FR/EN) */}
        <button
          onClick={() => setRandomLang("fr")}
          className={`px-2.5 py-2.5 text-sm font-bold transition-all cursor-pointer ${
            randomLang === "fr"
              ? "bg-mauve/20 text-mauve-light"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🇫🇷
        </button>
        <button
          onClick={() => setRandomLang("en")}
          className={`px-2.5 py-2.5 text-sm font-bold transition-all cursor-pointer ${
            randomLang === "en"
              ? "bg-mauve/20 text-mauve-light"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🇬🇧
        </button>

        {/* Separator bar */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Random course button */}
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

      {/* ── UI language toggle (separate) ── */}
      <button
        onClick={() => updateLang(lang === "fr" ? "en" : "fr")}
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
