"use client";

import { BookOpen, Library, Route, CreditCard, GraduationCap, Globe } from "lucide-react";
import { useAppStore, type AppView } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const tx = t(lang);

  const NAV_ITEMS: { view: AppView; label: string; icon: typeof BookOpen }[] = [
    { view: "create", label: tx.nav.create, icon: BookOpen },
    { view: "library", label: tx.nav.library, icon: Library },
    { view: "journey", label: tx.nav.journey, icon: Route },
    { view: "offers", label: tx.nav.offers, icon: CreditCard },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-[72px] md:w-64 bg-night-light border-r border-border z-40 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-border">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-mauve to-mauve-dark flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <span className="hidden md:block text-xl font-extrabold gradient-text">
          {tx.app.name}
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-6 px-2 md:px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = view === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-mauve/20 text-mauve-light glow-mauve"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <item.icon
                className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-mauve-light" : ""}`}
              />
              <span className="hidden md:block text-base font-semibold">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom section — Language toggle */}
      <div className="px-2 md:px-3 py-4 border-t border-border">
        <button
          onClick={() => setLang(lang === "fr" ? "en" : "fr")}
          className="w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3.5 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-200 cursor-pointer"
        >
          <Globe className="w-5 h-5 flex-shrink-0" />
          <span className="hidden md:block text-base font-semibold">
            {lang === "fr" ? "Français" : "English"}
          </span>
          <span className="hidden md:inline-flex ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-mauve/15 text-mauve-light">
            {lang === "fr" ? "FR" : "EN"}
          </span>
        </button>
      </div>
    </aside>
  );
}
