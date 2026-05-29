"use client";

import { useEffect } from "react";
import { BookOpen, Library, Route, Tag } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useSession } from "@/hooks/useSession";
import Sidebar from "@/components/coursia/Sidebar";
import LandingPage from "@/components/coursia/LandingPage";
import AuthPage from "@/components/coursia/AuthPage";
import CreateCourse from "@/components/coursia/CreateCourse";
import LibraryPage from "@/components/coursia/Library";
import CourseViewer from "@/components/coursia/CourseViewer";
import Journey from "@/components/coursia/Journey";
import OffersPage from "@/components/coursia/OffersPage";
import TopBar from "@/components/coursia/TopBar";

function MobileBottomNav() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);

  const NAV_ITEMS = [
    { view: "create" as const, label: tx.nav.create, icon: BookOpen },
    { view: "library" as const, label: tx.nav.library, icon: Library },
    { view: "journey" as const, label: tx.nav.journey, icon: Route },
    { view: "offers" as const, label: tx.nav.offers, icon: Tag },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-night-light/95 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around py-1.5 px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = view === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-2 sm:px-3 rounded-xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? "text-mauve-light"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-mauve-light" : ""}`} />
              <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AppShell() {
  const view = useAppStore((s) => s.view);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const user = useAppStore((s) => s.user);
  const setAuthToken = useAppStore((s) => s.setAuthToken);

  // Restore session (validates token with server and restores user data)
  useSession();

  // Restore auth token from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("coursia-auth-token");
      if (savedToken) {
        setAuthToken(savedToken);
      }
    }
  }, [setAuthToken]);

  return (
    <div className="min-h-screen bg-night">
      {view === "landing" ? (
        <LandingPage />
      ) : view === "auth" ? (
        <AuthPage />
      ) : (
        <div className="min-h-screen">
          <Sidebar />
          {view !== "viewer" && <TopBar />}
          <main
            className={`min-h-screen transition-all duration-300 ease-in-out pb-16 md:pb-0 ${
              collapsed
                ? "ml-0 md:ml-[72px]"
                : "ml-0 md:ml-[72px] lg:ml-64"
            }`}
          >
            {view === "create" && <CreateCourse />}
            {view === "library" && <LibraryPage />}
            {view === "viewer" && <CourseViewer />}
            {view === "journey" && <Journey />}
            {view === "offers" && <OffersPage />}
          </main>
          <MobileBottomNav />
        </div>
      )}
    </div>
  );
}
