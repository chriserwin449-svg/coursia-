"use client";

import { BookOpen, Library, Route, GraduationCap, PanelLeftClose, PanelLeftOpen, Tag } from "lucide-react";
import { useAppStore, type AppView } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  const NAV_ITEMS: { view: AppView; label: string; icon: typeof BookOpen }[] = [
    { view: "create", label: tx.nav.create, icon: BookOpen },
    { view: "library", label: tx.nav.library, icon: Library },
    { view: "journey", label: tx.nav.journey, icon: Route },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 flex flex-col border-r border-border bg-night-light transition-all duration-300 ease-in-out overflow-hidden ${
        collapsed ? "w-[72px]" : "w-[72px] md:w-64"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-mauve to-mauve-dark flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && <span className="hidden md:block text-xl font-extrabold gradient-text whitespace-nowrap">
          {tx.app.name}
        </span>}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 md:px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = view === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-mauve/20 text-mauve-light glow-mauve"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <item.icon
                className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-mauve-light" : ""}`}
              />
              {!collapsed && <span className="hidden md:block text-base font-semibold truncate">
                {item.label}
              </span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom section — Collapse toggle + Offers */}
      <div className="px-2 md:px-3 py-3 border-t border-border space-y-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? (lang === "fr" ? "Ouvrir" : "Open") : (lang === "fr" ? "Réduire" : "Collapse")}
          className="w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-200 cursor-pointer"
        >
          {collapsed ? (
            <PanelLeftOpen className="w-5 h-5 flex-shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="w-5 h-5 flex-shrink-0" />
              <span className="hidden md:block text-base font-semibold truncate">
                {lang === "fr" ? "Réduire" : "Collapse"}
              </span>
            </>
          )}
        </button>

        {/* Offers link — subtle, at the very bottom */}
        <button
          onClick={() => setView("offers")}
          title={collapsed ? tx.nav.offers : undefined}
          className={`w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-2xl transition-all duration-200 cursor-pointer ${
            view === "offers"
              ? "bg-gold/10 text-gold"
              : "text-muted-foreground/50 hover:bg-white/5 hover:text-muted-foreground"
          }`}
        >
          <Tag className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="hidden md:block text-sm font-semibold truncate">
            {tx.nav.offers}
          </span>}
        </button>
      </div>
    </aside>
  );
}
